import { array, enum as oneOf, number, object, string } from 'zod'
import { currentCategoryId, LIMITS, SITE_STATUS, VISIBILITY } from './constants.js'
import { GAME_MODELS, JOB_KIND } from './game.js'
import { NOTIFY_MODE } from './tables.js'

// The admin sign-in constants live in google.js (no zod, so the site can use them cheaply).

const idToken = string().min(100).max(4096)
const storyId = string().regex(/^st_[A-Za-z0-9]{6,40}$/)
const mediaId = string().regex(/^md_[A-Za-z0-9]{6,40}$/)
const text = (max) => string().trim().max(max)

export const adminAuthSchema = object({ id_token: idToken })
export const adminStorySchema = object({ id_token: idToken, id: storyId })
export const adminVisibilitySchema = object({
  id_token: idToken,
  id: storyId,
  visibility: oneOf([VISIBILITY.DEFAULT, VISIBILITY.HIDDEN, VISIBILITY.EARLY]),
})
export const adminMediaUpdateSchema = object({
  id_token: idToken,
  media_id: mediaId,
  caption: text(200),
  year_approx: number().int().min(1940).max(2030).nullable().optional(),
  people: array(string().trim().min(1).max(60))
    .max(20)
    .optional()
    .transform((v) => v ?? []),
})
export const adminStoryUpdateSchema = object({
  id_token: idToken,
  id: storyId,
  title: text(120),
  content: text(LIMITS.STORY_CONTENT_MAX),
  excerpt: text(300),
  author_name: text(60).min(1),
  author_relation: text(80),
  category_id: string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/)
    .transform(currentCategoryId),
  admin_notes: text(1000),
})
export const adminSettingsSchema = object({
  id_token: idToken,
  notify_mode: oneOf(Object.values(NOTIFY_MODE)),
})
export const adminSiteStatusSchema = object({
  id_token: idToken,
  site_status: oneOf([SITE_STATUS.COLLECTING, SITE_STATUS.PUBLISHED]),
})
export const adminMediaSchema = object({ id_token: idToken, media_id: mediaId })
export const adminGameConfigSchema = object({
  id_token: idToken,
  model: oneOf(GAME_MODELS.map((m) => m.id)),
})
export const adminGameJobSchema = object({
  id_token: idToken,
  kind: oneOf(Object.values(JOB_KIND)),
})
