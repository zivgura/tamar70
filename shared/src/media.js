import { array, number, object, string } from 'zod'

// Photos go from the browser straight to Drive (originals, no compression). Apps Script only
// opens the upload session and confirms the result.

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024
export const MAX_PHOTOS_PER_STORY = 20

// What phones and cameras produce. iPhone galleries usually hand Safari a JPEG; HEIC is
// accepted in case one arrives as-is.
export const PHOTO_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
])

// The site's own origins: live, Firebase preview channels, local dev. A Drive upload session
// only accepts the browser upload from the origin it was opened for.
const SITE_ORIGIN =
  /^(https:\/\/tamar70(--[a-z0-9-]+)?\.(web\.app|firebaseapp\.com)|http:\/\/localhost:5173)$/

export function isSiteOrigin(origin) {
  return SITE_ORIGIN.test(String(origin ?? ''))
}

const storyId = string().regex(/^st_[A-Za-z0-9]{6,40}$/)
const mediaId = string().regex(/^md_[A-Za-z0-9]{6,40}$/)
const editToken = string().regex(/^[A-Za-z0-9_-]{32,128}$/)
const shortText = (max) =>
  string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || '')

export const mediaStartSchema = object({
  story_id: storyId,
  edit_token: editToken,
  origin: string().refine(isSiteOrigin, 'Not a site origin'),
  filename: string().trim().min(1).max(200),
  mime: string().refine((m) => PHOTO_TYPES.includes(m), 'Not a supported photo type'),
  bytes: number().int().min(1).max(MAX_PHOTO_BYTES),
  caption: shortText(200),
  place: shortText(80),
  year_approx: number().int().min(1940).max(2030).optional(),
  people: array(string().trim().min(1).max(60))
    .max(20)
    .optional()
    .transform((v) => v ?? []),
  sort_order: number().int().min(0).max(999).optional(),
})

export const mediaUpdateSchema = object({
  story_id: storyId,
  edit_token: editToken,
  media_id: mediaId,
  caption: shortText(200),
  place: shortText(80),
  year_approx: number().int().min(1940).max(2030).nullable().optional(),
  people: array(string().trim().min(1).max(60))
    .max(20)
    .optional()
    .transform((v) => v ?? []),
})

export const mediaRemoveSchema = object({
  story_id: storyId,
  edit_token: editToken,
  media_id: mediaId,
})

export const mediaFinishSchema = object({
  story_id: storyId,
  edit_token: editToken,
  media_id: mediaId,
  drive_file_id: string().regex(/^[A-Za-z0-9_-]{10,100}$/),
})

/** A filename safe to keep in Drive: no path parts, no control characters, not too long. */
export function safeFilename(name) {
  const base = String(name ?? '')
    .split(/[\\/]/)
    .pop()
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
  return (base || 'photo').slice(-100)
}
