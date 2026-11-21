// Sends a finished story: first the story itself (so it's saved even if a photo fails), then
// each photo straight to Drive. Photo failures are reported per photo and can be retried
// without sending the story again.
import { STORY_KIND } from '@tamar70/shared'
import { api } from '../api/client.js'
import { uploadPhoto } from '../upload/uploadPhoto.js'
import { splitList } from './deviceStore.js'

/** The kind the server should store, from what was actually filled in. */
export function storyKind(content, photoCount) {
  const hasText = content.trim().length > 0
  if (hasText && photoCount > 0) return STORY_KIND.MIXED
  return hasText ? STORY_KIND.TEXT : STORY_KIND.PHOTOS
}

/** The stories.submit payload for a draft. */
export function submission({ draft, author, photos, editToken }) {
  return {
    edit_token: editToken,
    kind: storyKind(draft.content, photos.length),
    author_name: author.name.trim(),
    author_relation: author.relation.trim(),
    title: draft.title.trim(),
    content: draft.content.trim(),
    category_id: draft.category_id ?? undefined,
    ...(draft.decade ? { decade: draft.decade } : {}),
    places: splitList(draft.place),
    people: splitList(draft.people),
  }
}

/** Creates the story. Safe to call again with the same edit token: no duplicate is made. */
export async function createStory(payload, { apiImpl = api } = {}) {
  const { id } = await apiImpl.submitStory(payload)
  return id
}

/** The details sent with one photo. */
export function photoDetails(photo, index) {
  const year = Number.parseInt(photo.year, 10)
  return {
    caption: photo.caption?.trim() || undefined,
    ...(Number.isInteger(year) && year >= 1940 && year <= 2030 ? { year_approx: year } : {}),
    people: splitList(photo.people),
    sort_order: index,
  }
}

/**
 * Uploads the photos one after another. `onPhoto(key, patch)` receives
 * { stage, progress } updates, then { stage: 'done' } or { stage: 'error', error }.
 * Resolves with the number of photos that failed.
 */
export async function uploadPhotos({
  storyId,
  editToken,
  photos,
  onPhoto,
  uploadImpl = uploadPhoto,
}) {
  let failed = 0
  for (const [index, photo] of photos.entries()) {
    try {
      await uploadImpl({
        file: photo.file,
        storyId,
        editToken,
        details: photoDetails(photo, index),
        onStage: (stage) => onPhoto(photo.key, { stage }),
        onProgress: (progress) => onPhoto(photo.key, { progress }),
      })
      onPhoto(photo.key, { stage: 'done', progress: 1 })
    } catch (error) {
      failed++
      onPhoto(photo.key, { stage: 'error', error })
    }
  }
  return failed
}

/**
 * Keeps the Word files a story's text came from, in Drive with its photos. Best effort: the
 * text is already in the story, so a failed upload is only logged by the browser.
 */
export async function uploadDocuments({ storyId, editToken, files, uploadImpl = uploadPhoto }) {
  for (const [index, file] of files.entries()) {
    try {
      await uploadImpl({ file, storyId, editToken, details: { sort_order: 900 + index } })
    } catch {
      // Nothing to show: the story's text doesn't depend on the file.
    }
  }
}
