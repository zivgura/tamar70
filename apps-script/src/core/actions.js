import {
  ACTIONS,
  CATEGORY_TONES,
  DEFAULT_CATEGORY_ID,
  DEFAULT_TONE,
  ERROR_CODES,
  getStoryView,
  makeExcerpt,
  STORY_STATUS,
  STORY_VIEW,
  storyIdSchema,
  storySubmissionSchema,
  toPublicStory,
  VISIBILITY,
} from '@tamar70/shared'
import { adminHandlers } from './admin.js'
import { gameHandlers } from './game.js'
import { telemetryHandlers, underHourlyLimit } from './telemetry.js'
import { ApiError, notFound } from './errors.js'
import { finishUpload, invalidatePublicCache, startUpload } from './media.js'
import {
  deleteOwnStory,
  getOwnStory,
  removeOwnMedia,
  updateOwnMedia,
  updateOwnStory,
} from './own.js'
import { importGoogleDoc } from './googleDocs.js'
import { galleryPhotos, sharedPhotosByStory } from './reveal.js'
import { readSettings, siteConfig } from './settings.js'

const LIST_CACHE_KEY = 'stories.list'
const BOOTSTRAP_CACHE_KEY = 'site.bootstrap'
const GALLERY_CACHE_KEY = 'gallery.list'
const CACHE_SECONDS = 60
// CacheService refuses values over 100 KB; stay well under.
const CACHE_MAX_CHARS = 90_000

const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at))

/**
 * Every visible story for lists. A story shown in full comes as a card: no text (the story
 * page loads it), plus its first shared photo as a cover.
 */
function publicStories(ctx, config) {
  let photos = null // read once, only if some story is shown in full
  return ctx.db
    .all('Stories')
    .sort(byNewest)
    .map((s) => toPublicStory(s, getStoryView(s, config.site_status)))
    .filter(Boolean)
    .map((s) => {
      if (s.view !== STORY_VIEW.FULL) return s
      const { content: _text, ...card } = s
      photos ??= sharedPhotosByStory(ctx)
      const first = photos.get(s.id)?.[0]
      return { ...card, cover: first ? first.thumb : null }
    })
}

/** Caches JSON-able results for a minute, unless too big for CacheService. */
function cached(ctx, key, compute) {
  const hit = ctx.cache.get(key)
  if (hit) return JSON.parse(hit)
  const value = compute()
  const json = JSON.stringify(value)
  if (json.length <= CACHE_MAX_CHARS) ctx.cache.put(key, json, CACHE_SECONDS)
  return value
}

function siteInfo(config, shown) {
  const contributors = new Set(shown.map((s) => String(s.author_name).trim().toLowerCase()))
  return {
    site_status: config.site_status,
    birthday_date: config.birthday_date,
    submissions_open: config.submissions_open,
    comments_open: config.comments_open,
    reveal_message: config.site_status === 'published' ? config.reveal_message : '',
    stats: {
      stories: shown.length,
      contributors: contributors.size,
      photos: shown.reduce((n, s) => n + (s.media_count || 0), 0),
    },
  }
}

function getSite(ctx) {
  const config = siteConfig(readSettings(ctx.db))
  const shown = ctx.db
    .all('Stories')
    .filter((s) => getStoryView(s, config.site_status) !== STORY_VIEW.NONE)
  return siteInfo(config, shown)
}

/** Everything a page needs to render, in one round trip (each call costs seconds). */
function bootstrap(ctx) {
  return cached(ctx, BOOTSTRAP_CACHE_KEY, () => {
    const config = siteConfig(readSettings(ctx.db))
    const stories = publicStories(ctx, config)
    return { site: siteInfo(config, stories), categories: listCategories(ctx), stories }
  })
}

function listCategories(ctx) {
  return ctx.db
    .all('Categories')
    .filter((c) => c.active && c.id)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map(({ id, name, description, prompt_hint, color }) => ({
      id,
      name,
      description,
      prompt_hint,
      // A design-system tone name; anything else in the Sheet falls back to the neutral tone.
      tone: CATEGORY_TONES.includes(color) ? color : DEFAULT_TONE,
    }))
}

function listStories(ctx) {
  return cached(ctx, LIST_CACHE_KEY, () => {
    const config = siteConfig(readSettings(ctx.db))
    return { site_status: config.site_status, stories: publicStories(ctx, config) }
  })
}

function getStory(ctx, payload) {
  const { id } = storyIdSchema.parse(payload)
  const story = ctx.db.all('Stories').find((s) => s.id === id)
  if (!story) throw notFound('Story not found')
  const config = siteConfig(readSettings(ctx.db))
  const out = toPublicStory(story, getStoryView(story, config.site_status))
  if (!out) throw notFound('Story not found')
  if (out.view === STORY_VIEW.FULL) out.photos = sharedPhotosByStory(ctx).get(story.id) ?? []
  return out
}

/** Every photo open to the public, for the gallery page. */
function listGallery(ctx) {
  return cached(ctx, GALLERY_CACHE_KEY, () => ({ photos: galleryPhotos(ctx) }))
}

const SUBMISSIONS_PER_HOUR = 60

function submitStory(ctx, payload) {
  // Bots that fill the hidden field get a convincing success and nothing is saved.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return { id: `st_${ctx.crypto.randomId(12)}`, duplicate: false }
  }

  const input = storySubmissionSchema.parse(payload)
  const config = siteConfig(readSettings(ctx.db))

  // Anyone with the address can add a story. What keeps it tidy: the hidden honeypot field
  // above, this hourly cap, an email to the admins for each story, and hide/delete in admin.
  if (!underHourlyLimit(ctx, 'submissions', SUBMISSIONS_PER_HOUR)) {
    throw new ApiError(ERROR_CODES.BUSY, 'Too many stories this hour, try again later')
  }
  if (!config.submissions_open) {
    throw new ApiError(ERROR_CODES.SUBMISSIONS_CLOSED, 'Submissions are closed')
  }

  const activeCategories = new Set(listCategories(ctx).map((c) => c.id))
  const categoryId = activeCategories.has(input.category_id)
    ? input.category_id
    : DEFAULT_CATEGORY_ID
  const editTokenHash = ctx.crypto.sha256(input.edit_token)

  const result = ctx.lock.run(() => {
    const existing = ctx.db.all('Stories').find((s) => s.edit_token_hash === editTokenHash)
    if (existing) return { id: existing.id, duplicate: true }

    const ts = ctx.now()
    const story = {
      id: `st_${ctx.crypto.randomId(12)}`,
      kind: input.kind,
      title: input.title,
      content: input.content,
      excerpt: makeExcerpt(input.content),
      author_name: input.author_name,
      author_relation: input.author_relation,
      category_id: categoryId,
      decade: input.decade ?? null,
      year_approx: input.year_approx ?? null,
      places: input.places,
      people: input.people,
      tags: input.tags,
      status: STORY_STATUS.ACTIVE,
      visibility: VISIBILITY.DEFAULT,
      featured: false,
      media_count: 0,
      created_at: ts,
      updated_at: ts,
      admin_notes: '',
      edit_token_hash: editTokenHash,
    }
    ctx.db.insert('Stories', story)
    return { id: story.id, duplicate: false }
  })

  invalidatePublicCache(ctx)
  return result
}

export const handlers = {
  [ACTIONS.SITE]: getSite,
  [ACTIONS.BOOTSTRAP]: bootstrap,
  [ACTIONS.CATEGORIES_LIST]: listCategories,
  [ACTIONS.STORIES_LIST]: listStories,
  [ACTIONS.STORIES_GET]: getStory,
  [ACTIONS.GALLERY]: listGallery,
  [ACTIONS.GOOGLE_DOC_IMPORT]: importGoogleDoc,
  [ACTIONS.STORIES_SUBMIT]: submitStory,
  [ACTIONS.MEDIA_START]: startUpload,
  [ACTIONS.MEDIA_FINISH]: finishUpload,
  [ACTIONS.OWN_GET]: getOwnStory,
  [ACTIONS.OWN_UPDATE]: updateOwnStory,
  [ACTIONS.OWN_DELETE]: deleteOwnStory,
  [ACTIONS.OWN_MEDIA_UPDATE]: updateOwnMedia,
  [ACTIONS.OWN_MEDIA_REMOVE]: removeOwnMedia,
  ...adminHandlers,
  ...gameHandlers,
  ...telemetryHandlers,
}
