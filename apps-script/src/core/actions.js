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
import { ApiError, notFound } from './errors.js'
import { readSettings, siteConfig } from './settings.js'

const PUBLIC_LIST_CACHE_KEY = 'stories.list'
const CACHE_SECONDS = 60
// CacheService refuses values over 100 KB; stay well under.
const CACHE_MAX_CHARS = 90_000

const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at))

function publicStories(ctx, config) {
  return ctx.db
    .all('Stories')
    .sort(byNewest)
    .map((s) => toPublicStory(s, getStoryView(s, config.site_status)))
    .filter(Boolean)
}

function getSite(ctx) {
  const config = siteConfig(readSettings(ctx.db))
  const shown = ctx.db
    .all('Stories')
    .filter((s) => getStoryView(s, config.site_status) !== STORY_VIEW.NONE)
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
  const cached = ctx.cache.get(PUBLIC_LIST_CACHE_KEY)
  if (cached) return JSON.parse(cached)

  const config = siteConfig(readSettings(ctx.db))
  const result = { site_status: config.site_status, stories: publicStories(ctx, config) }
  const json = JSON.stringify(result)
  if (json.length <= CACHE_MAX_CHARS) ctx.cache.put(PUBLIC_LIST_CACHE_KEY, json, CACHE_SECONDS)
  return result
}

function getStory(ctx, payload) {
  const { id } = storyIdSchema.parse(payload)
  const story = ctx.db.all('Stories').find((s) => s.id === id)
  if (!story) throw notFound('Story not found')
  const config = siteConfig(readSettings(ctx.db))
  const out = toPublicStory(story, getStoryView(story, config.site_status))
  if (!out) throw notFound('Story not found')
  return out
}

function submitStory(ctx, payload) {
  // Bots that fill the hidden field get a convincing success and nothing is saved.
  if (typeof payload.website === 'string' && payload.website.trim() !== '') {
    return { id: `st_${ctx.crypto.randomId(12)}`, duplicate: false }
  }

  const input = storySubmissionSchema.parse(payload)
  const config = siteConfig(readSettings(ctx.db))

  if (
    !config.family_code_hash ||
    ctx.crypto.sha256(input.family_code) !== config.family_code_hash
  ) {
    throw new ApiError(ERROR_CODES.BAD_FAMILY_CODE, 'The family code is missing or wrong')
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

  ctx.cache.remove(PUBLIC_LIST_CACHE_KEY)
  return result
}

export const handlers = {
  [ACTIONS.SITE]: getSite,
  [ACTIONS.CATEGORIES_LIST]: listCategories,
  [ACTIONS.STORIES_LIST]: listStories,
  [ACTIONS.STORIES_GET]: getStory,
  [ACTIONS.STORIES_SUBMIT]: submitStory,
}
