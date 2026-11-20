// Named imports (not `z`) so bundlers can leave out zod's translated error messages:
// that's about 270 KB of the Apps Script bundle.
import { array, enum as oneOf, number, object, record, string, unknown } from 'zod'
import { DEFAULT_CATEGORY_ID, LIMITS, STORY_KIND } from './constants.js'

const MAX_LIST_ITEMS = 20

const trimmed = (max) => string().trim().max(max)
const optionalText = (max) =>
  trimmed(max)
    .optional()
    .transform((v) => v || '')
const nameList = array(trimmed(60).min(1))
  .max(MAX_LIST_ITEMS)
  .optional()
  .transform((v) => v ?? [])

const storyId = string().regex(/^st_[A-Za-z0-9]{6,40}$/)
// Private random token the contributor's device creates and keeps, to edit the story later.
// The server stores only its hash.
const editToken = string().regex(/^[A-Za-z0-9_-]{32,128}$/)

export const apiRequestSchema = object({
  action: string().min(1).max(50),
  payload: record(string(), unknown()).optional().default({}),
})

// What a contributor writes, the same for a new story and an edit.
const storyFields = {
  kind: oneOf(Object.values(STORY_KIND)),
  author_name: trimmed(60).min(1),
  author_relation: optionalText(80),
  title: optionalText(120),
  content: optionalText(LIMITS.STORY_CONTENT_MAX),
  category_id: string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional()
    .transform((v) => v || DEFAULT_CATEGORY_ID),
  decade: number().int().min(1950).max(2020).multipleOf(10).optional(),
  year_approx: number().int().min(1950).max(2030).optional(),
  places: nameList,
  people: nameList,
  tags: nameList,
}

const needsText = [
  (s) => s.kind === STORY_KIND.PHOTOS || s.content.length > 0,
  { path: ['content'], message: 'Content is required unless the story is photos only' },
]

export const storySubmissionSchema = object({
  ...storyFields,
  // A retried submission with the same token isn't saved twice.
  edit_token: editToken,
  family_code: string().trim().min(1).max(64),
  // Honeypot: a hidden field real people leave empty.
  website: string().max(0, 'honeypot').optional(),
}).refine(...needsText)

export const storyUpdateSchema = object({
  ...storyFields,
  id: storyId,
  edit_token: editToken,
}).refine(...needsText)

export const ownStorySchema = object({ id: storyId, edit_token: editToken })

export const storyIdSchema = object({ id: storyId })
