import { array, number, object, string } from 'zod'
import { isDocumentMime, isPhotoMime, isSiteOrigin, MAX_PHOTO_BYTES } from './files.js'

// Photos go from the browser straight to Drive (originals, no compression). Apps Script only
// opens the upload session and confirms the result.

const storyId = string().regex(/^st_[A-Za-z0-9]{6,40}$/)
const mediaId = string().regex(/^md_[A-Za-z0-9]{6,40}$/)
const editToken = string().regex(/^[A-Za-z0-9_-]{32,128}$/)
const shortText = (max) =>
  string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || '')

// One file to upload: its name, type, size and the details shown with it.
const fileFields = {
  filename: string().trim().min(1).max(200),
  mime: string().refine((m) => isPhotoMime(m) || isDocumentMime(m), 'Not a supported file type'),
  bytes: number().int().min(1).max(MAX_PHOTO_BYTES),
  caption: shortText(200),
  place: shortText(80),
  year_approx: number().int().min(1940).max(2030).optional(),
  people: array(string().trim().min(1).max(60))
    .max(20)
    .optional()
    .transform((v) => v ?? []),
  sort_order: number().int().min(0).max(999).optional(),
}

export const mediaStartSchema = object({
  story_id: storyId,
  edit_token: editToken,
  origin: string().refine(isSiteOrigin, 'Not a site origin'),
  ...fileFields,
})

// Several files at once: one server call opens an upload session for each (a story's photos
// plus up to 3 Word documents).
export const mediaStartManySchema = object({
  story_id: storyId,
  edit_token: editToken,
  origin: string().refine(isSiteOrigin, 'Not a site origin'),
  files: array(object(fileFields)).min(1).max(23),
})

// The files the browser uploaded, confirmed together in one call.
export const mediaFinishManySchema = object({
  story_id: storyId,
  edit_token: editToken,
  items: array(
    object({ media_id: mediaId, drive_file_id: string().regex(/^[A-Za-z0-9_-]{10,100}$/) }),
  )
    .min(1)
    .max(23),
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
