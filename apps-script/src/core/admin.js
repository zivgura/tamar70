// The admin area: signed-in admins see every story (hidden and deleted ones too), fix text,
// hide, delete and remove photos. Every call proves who it is with a Google ID token.
import {
  ACTIONS,
  adminAuthSchema,
  adminMediaSchema,
  adminStorySchema,
  adminStoryUpdateSchema,
  adminVisibilitySchema,
  DEFAULT_CATEGORY_ID,
  ERROR_CODES,
  GOOGLE_CLIENT_ID,
  GOOGLE_ISSUERS,
  makeExcerpt,
  STORY_STATUS,
  UPLOAD_STATUS,
} from '@tamar70/shared'
import { ApiError, notFound } from './errors.js'
import { invalidatePublicCache, mediaOf } from './media.js'
import { livePhotos, recountPhotos, trashQuietly } from './own.js'
import { readSettings, siteConfig } from './settings.js'
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
  const photos = mediaOf(ctx, story.id)
    .filter((m) => m.upload_status !== UPLOAD_STATUS.REMOVED)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((m) => ({
      id: m.id,
      filename: m.filename,
      caption: m.caption,
      year_approx: m.year_approx,
      people: m.people,
      place: m.place,
      bytes: m.bytes,
      upload_status: m.upload_status,
      uploaded_at: m.uploaded_at,
      thumbnail:
        m.upload_status === UPLOAD_STATUS.DONE && m.drive_file_id
          ? ctx.drive.thumbnail(m.drive_file_id)
          : null,
    }))
  return { story: adminView(story), photos, categories: categories(ctx) }
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

function adminStats(ctx, payload) {
  const { id_token } = adminAuthSchema.parse(payload)
  requireAdmin(ctx, id_token)
  return stats(ctx)
}

export const adminHandlers = {
  [ACTIONS.ADMIN_ME]: me,
  [ACTIONS.ADMIN_STORIES]: listStories,
  [ACTIONS.ADMIN_STORY]: getStory,
  [ACTIONS.ADMIN_STORY_UPDATE]: updateStory,
  [ACTIONS.ADMIN_VISIBILITY]: setVisibility,
  [ACTIONS.ADMIN_STORY_DELETE]: deleteStory,
  [ACTIONS.ADMIN_MEDIA_REMOVE]: removeMedia,
  [ACTIONS.ADMIN_STATS]: adminStats,
}
