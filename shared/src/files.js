// File types and limits, and the site's own origins. No zod here, so the site can import
// these without pulling in the schema library (the schemas are for the server).

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

// A Word document someone wrote instead of typing: its text goes into the story, and the
// original file is kept in Drive with the photos (never shown publicly).
export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const DOCUMENT_TYPES = Object.freeze([DOCX_TYPE])
export const MAX_DOCUMENTS_PER_STORY = 3

export const isPhotoMime = (mime) => PHOTO_TYPES.includes(mime)
export const isDocumentMime = (mime) => DOCUMENT_TYPES.includes(mime)
/** A Media row is a photo unless it's a document (older rows have no other kind). */
export const isPhotoMedia = (media) => !isDocumentMime(media.mime)

// The site's own origins: live, Firebase preview channels, local dev. A Drive upload session
// only accepts the browser upload from the origin it was opened for.
const SITE_ORIGIN =
  /^(https:\/\/tamar70(--[a-z0-9-]+)?\.(web\.app|firebaseapp\.com)|http:\/\/localhost:5173)$/

export function isSiteOrigin(origin) {
  return SITE_ORIGIN.test(String(origin ?? ''))
}
