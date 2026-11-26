// The admin area: signed-in admins see every story (hidden and deleted ones too), fix text,
// hide, delete and remove photos. Every call proves who it is with a Google ID token.
import {
  ACTIONS,
  adminAuthSchema,
  adminMediaSchema,
  adminMediaUpdateSchema,
  adminSettingsSchema,
  adminSiteStatusSchema,
  NOTIFY_MODE,
  SETTING_KEYS,
  adminStorySchema,
  adminStoryUpdateSchema,
  adminVisibilitySchema,
  DEFAULT_CATEGORY_ID,
  ERROR_CODES,
  GOOGLE_CLIENT_ID,
  GOOGLE_ISSUERS,
  isPhotoMedia,
  makeExcerpt,
  STORY_STATUS,
  UPLOAD_STATUS,
} from '@tamar70/shared'
import { ApiError, notFound } from './errors.js'
import { invalidatePublicCache, mediaOf } from './media.js'
import { livePhotos, recountPhotos, trashQuietly } from './own.js'
import { backupNow, backupStatus, exportAll } from './backup.js'
import { recipients, sendTestEmail } from './housekeeping.js'
import { sharingProgress, syncSharing } from './reveal.js'
import { readSettings, siteConfig, writeSetting } from './settings.js'
import { stats } from './telemetry.js'

// A checked token is remembered for a while, so each admin call doesn't ask Google again.
const VERIFIED_CACHE_SECONDS = 600

const signInRequired = () => new ApiError(ERROR_CODES.SIGN_IN_REQUIRED, 'Sign in with Google again')

const normalEmail = (email) =>
  String(email ?? '')
    .trim()
    .toLowerCase()

/** The signed-in Google address behind an ID token, after checking it was issued for us. */
function verifiedEmail(ctx, idToken) {
  const key = `admin:${ctx.crypto.sha256(idToken)}`
  const hit = ctx.cache.get(key)
  if (hit) return hit

  let claims
  try {
    claims = ctx.google.tokenInfo(idToken)
  } catch (err) {
    ctx.log.error(`Google token check failed: ${err && err.message}`)
    throw new ApiError(ERROR_CODES.BUSY, 'Could not check the sign-in, try again')
  }
  const nowSeconds = Math.floor(Date.parse(ctx.now()) / 1000)
  const expires = Number(claims?.exp ?? 0)
  const valid =
    claims &&
    claims.aud === GOOGLE_CLIENT_ID &&
    GOOGLE_ISSUERS.includes(claims.iss) &&
    String(claims.email_verified) === 'true' &&
    expires > nowSeconds
  if (!valid) throw signInRequired()

  const email = normalEmail(claims.email)
  const seconds = Math.min(VERIFIED_CACHE_SECONDS, expires - nowSeconds)
  if (seconds > 0) ctx.cache.put(key, email, seconds)
  return email
}

/** The admin making this call. AdminUsers is read every time, so removing a row takes effect at once. */
export function requireAdmin(ctx, idToken) {
  if (!idToken) throw signInRequired()
  const email = verifiedEmail(ctx, idToken)
  const admin = ctx.db.all('AdminUsers').find((a) => normalEmail(a.email) === email)
  if (!admin) throw new ApiError(ERROR_CODES.NOT_ADMIN, 'This account is not an admin')
  return { email, name: admin.name || '' }
}

function audit(ctx, admin, action, targetId, details = {}) {
  ctx.db.insert('AuditLog', {
    ts: ctx.now(),
    admin_email: admin.email,
    action,
    target_id: targetId,
    details,
  })
}

function findStory(ctx, id, { allowDeleted = false } = {}) {
  const story = ctx.db.all('Stories').find((s) => s.id === id)
  if (!story || (!allowDeleted && story.status === STORY_STATUS.DELETED)) {
    throw notFound('Story not found')
  }
  return story
}

// Everything but the edit token hash, which nobody needs to see.
function adminView(story) {
  const { edit_token_hash: _secret, ...rest } = story
  return rest
}

const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at))

function categories(ctx) {
  return ctx.db
    .all('Categories')
    .filter((c) => c.id)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map(({ id, name, active }) => ({ id, name, active }))
}

function me(ctx, payload) {
  const { id_token } = adminAuthSchema.parse(payload)
  return requireAdmin(ctx, id_token)
}

function listStories(ctx, payload) {
  const { id_token } = adminAuthSchema.parse(payload)
  requireAdmin(ctx, id_token)
  const config = siteConfig(readSettings(ctx.db))
  return {
    site_status: config.site_status,
    categories: categories(ctx),
    stories: ctx.db
      .all('Stories')
      .filter((s) => s.id)
      .sort(byNewest)
      .map(adminView),
  }
}

function getStory(ctx, payload) {
  const { id_token, id } = adminStorySchema.parse(payload)
  requireAdmin(ctx, id_token)
  const story = findStory(ctx, id, { allowDeleted: true })
  const media = mediaOf(ctx, story.id)
    .filter((m) => m.upload_status !== UPLOAD_STATUS.REMOVED)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  // Word files the story's text came from: a link to open them in Drive.
  const documents = media
    .filter((m) => !isPhotoMedia(m) && m.upload_status === UPLOAD_STATUS.DONE)
    .map((m) => ({
      id: m.id,
      filename: m.filename,
      bytes: m.bytes,
      link: `https://drive.google.com/file/d/${m.drive_file_id}/view`,
    }))
  const photos = media.filter(isPhotoMedia).map((m) => ({
    id: m.id,
    filename: m.filename,
    caption: m.caption,
    year_approx: m.year_approx,
    people: m.people,
    place: m.place,
    bytes: m.bytes,
    upload_status: m.upload_status,
    uploaded_at: m.uploaded_at,
    // The picture comes from admin.storyThumbs, so the story shows without waiting for Drive.
    has_thumbnail: m.upload_status === UPLOAD_STATUS.DONE && Boolean(m.drive_file_id),
  }))
  return { story: adminView(story), photos, documents, categories: categories(ctx) }
}

// Thumbnails don't change: keep each for 6 hours (CacheService's longest), so a story opened
// again shows its photos at once.
const THUMB_CACHE_SECONDS = 6 * 60 * 60
const THUMB_CACHE_MAX_CHARS = 95_000 // one cache value holds up to 100 KB

/** { media_id: data URL or null } for a story's finished photos. */
function storyThumbs(ctx, payload) {
  const { id_token, id } = adminStorySchema.parse(payload)
  requireAdmin(ctx, id_token)
  const story = findStory(ctx, id, { allowDeleted: true })
  const photos = mediaOf(ctx, story.id).filter(
    (m) => isPhotoMedia(m) && m.upload_status === UPLOAD_STATUS.DONE && m.drive_file_id,
  )
  const out = {}
  const missing = []
  for (const m of photos) {
    const hit = ctx.cache.get(`thumb:${m.drive_file_id}`)
    if (hit) out[m.id] = hit
    else missing.push(m)
  }
  if (missing.length) {
    const urls = ctx.drive.thumbnails(missing.map((m) => m.drive_file_id))
    missing.forEach((m, i) => {
      out[m.id] = urls[i] ?? null
      if (urls[i] && urls[i].length <= THUMB_CACHE_MAX_CHARS) {
        ctx.cache.put(`thumb:${m.drive_file_id}`, urls[i], THUMB_CACHE_SECONDS)
      }
    })
  }
  return { thumbnails: out }
}

function updateStory(ctx, payload) {
  const input = adminStoryUpdateSchema.parse(payload)
  const admin = requireAdmin(ctx, input.id_token)
  const story = findStory(ctx, input.id)
  const known = new Set(categories(ctx).map((c) => c.id))
  const patch = {
    title: input.title,
    content: input.content,
    // Left empty, the teaser goes back to the story's first sentence.
    excerpt: input.excerpt || makeExcerpt(input.content),
    author_name: input.author_name,
    author_relation: input.author_relation,
    category_id: known.has(input.category_id) ? input.category_id : DEFAULT_CATEGORY_ID,
    admin_notes: input.admin_notes,
    updated_at: ctx.now(),
  }
  ctx.lock.run(() => {
    ctx.db.update('Stories', 'id', story.id, patch)
    audit(ctx, admin, 'story.update', story.id)
  })
  invalidatePublicCache(ctx)
  return { story: adminView({ ...story, ...patch }) }
}

function setVisibility(ctx, payload) {
  const { id_token, id, visibility } = adminVisibilitySchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  const story = findStory(ctx, id)
  ctx.lock.run(() => {
    ctx.db.update('Stories', 'id', story.id, { visibility, updated_at: ctx.now() })
    audit(ctx, admin, 'story.visibility', story.id, { visibility })
  })
  // Its photos open or close with it (early → shared, hidden → private again).
  syncSharing(ctx, { storyId: story.id })
  invalidatePublicCache(ctx)
  return { id: story.id, visibility }
}

/** Same as a contributor's delete: the row stays as deleted, its photos go to the Drive trash. */
function deleteStory(ctx, payload) {
  const { id_token, id } = adminStorySchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  const story = findStory(ctx, id)
  const photos = mediaOf(ctx, story.id).filter((m) => m.upload_status !== UPLOAD_STATUS.REMOVED)
  ctx.lock.run(() => {
    ctx.db.update('Stories', 'id', story.id, {
      status: STORY_STATUS.DELETED,
      updated_at: ctx.now(),
    })
    for (const m of photos) {
      ctx.db.update('Media', 'id', m.id, { upload_status: UPLOAD_STATUS.REMOVED })
    }
    audit(ctx, admin, 'story.delete', story.id, { photos: photos.length })
  })
  for (const m of photos) trashQuietly(ctx, m.drive_file_id)
  invalidatePublicCache(ctx)
  return { id: story.id, deleted: true }
}

function removeMedia(ctx, payload) {
  const { id_token, media_id } = adminMediaSchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  const media = ctx.db.all('Media').find((m) => m.id === media_id)
  if (!media || media.upload_status === UPLOAD_STATUS.REMOVED) throw notFound('Photo not found')
  const story = ctx.db.all('Stories').find((s) => s.id === media.story_id)
  ctx.lock.run(() => {
    ctx.db.update('Media', 'id', media.id, { upload_status: UPLOAD_STATUS.REMOVED })
    if (story) recountPhotos(ctx, story)
    audit(ctx, admin, 'media.remove', media.id, { story_id: media.story_id })
  })
  trashQuietly(ctx, media.drive_file_id)
  invalidatePublicCache(ctx)
  return {
    media_id: media.id,
    removed: true,
    media_count: story ? livePhotos(ctx, story.id).length : 0,
  }
}

function updateMedia(ctx, payload) {
  const { id_token, media_id, caption, year_approx, people } = adminMediaUpdateSchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  const media = ctx.db.all('Media').find((m) => m.id === media_id)
  if (!media || media.upload_status === UPLOAD_STATUS.REMOVED) throw notFound('Photo not found')
  ctx.lock.run(() => {
    ctx.db.update('Media', 'id', media.id, {
      caption,
      year_approx: year_approx ?? null,
      people,
    })
    audit(ctx, admin, 'media.update', media.id, { story_id: media.story_id })
  })
  invalidatePublicCache(ctx)
  return { media_id: media.id, caption, year_approx: year_approx ?? null, people }
}

function adminStats(ctx, payload) {
  const { id_token } = adminAuthSchema.parse(payload)
  requireAdmin(ctx, id_token)
  return stats(ctx)
}

function settingsView(ctx) {
  const settings = readSettings(ctx.db)
  return {
    site_status: siteConfig(settings).site_status,
    sharing: sharingProgress(ctx),
    notify_mode: settings[SETTING_KEYS.NOTIFY_MODE] || NOTIFY_MODE.EACH,
    recipients: recipients(ctx),
    // When the 15-minute timer last ran, so a stopped timer shows up on the settings page.
    housekeeping_ran_at: settings[SETTING_KEYS.HOUSEKEEPING_RAN_AT] || null,
    backup: backupStatus(ctx),
  }
}

function getSettings(ctx, payload) {
  const { id_token } = adminAuthSchema.parse(payload)
  requireAdmin(ctx, id_token)
  return settingsView(ctx)
}

function updateSettings(ctx, payload) {
  const { id_token, notify_mode } = adminSettingsSchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  ctx.lock.run(() => {
    writeSetting(ctx.db, SETTING_KEYS.NOTIFY_MODE, notify_mode)
    audit(ctx, admin, 'settings.notify_mode', SETTING_KEYS.NOTIFY_MODE, { notify_mode })
  })
  return settingsView(ctx)
}

/**
 * The reveal button, and its undo. Stories open (or seal) at once; photos are shared (or made
 * private) here in a first batch, and the rest by the 15-minute timer.
 */
function setSiteStatus(ctx, payload) {
  const { id_token, site_status } = adminSiteStatusSchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  ctx.lock.run(() => {
    writeSetting(ctx.db, SETTING_KEYS.SITE_STATUS, site_status)
    audit(ctx, admin, 'site.status', SETTING_KEYS.SITE_STATUS, { site_status })
  })
  invalidatePublicCache(ctx)
  syncSharing(ctx)
  invalidatePublicCache(ctx)
  return settingsView(ctx)
}

function backup(ctx, payload) {
  const { id_token } = adminAuthSchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  const result = backupNow(ctx)
  audit(ctx, admin, 'backup', SETTING_KEYS.BACKED_UP_AT)
  return result
}

function exportStories(ctx, payload) {
  const { id_token } = adminAuthSchema.parse(payload)
  requireAdmin(ctx, id_token)
  return exportAll(ctx)
}

function testEmail(ctx, payload) {
  const { id_token } = adminAuthSchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  return sendTestEmail(ctx, admin.email)
}

export const adminHandlers = {
  [ACTIONS.ADMIN_ME]: me,
  [ACTIONS.ADMIN_STORIES]: listStories,
  [ACTIONS.ADMIN_STORY]: getStory,
  [ACTIONS.ADMIN_STORY_THUMBS]: storyThumbs,
  [ACTIONS.ADMIN_STORY_UPDATE]: updateStory,
  [ACTIONS.ADMIN_VISIBILITY]: setVisibility,
  [ACTIONS.ADMIN_STORY_DELETE]: deleteStory,
  [ACTIONS.ADMIN_MEDIA_REMOVE]: removeMedia,
  [ACTIONS.ADMIN_MEDIA_UPDATE]: updateMedia,
  [ACTIONS.ADMIN_STATS]: adminStats,
  [ACTIONS.ADMIN_SETTINGS]: getSettings,
  [ACTIONS.ADMIN_SETTINGS_UPDATE]: updateSettings,
  [ACTIONS.ADMIN_TEST_EMAIL]: testEmail,
  [ACTIONS.ADMIN_SITE_STATUS]: setSiteStatus,
  [ACTIONS.ADMIN_BACKUP]: backup,
  [ACTIONS.ADMIN_EXPORT]: exportStories,
}
