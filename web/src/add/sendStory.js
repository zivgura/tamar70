// Sends a finished story: first the story itself (so it's saved even if a photo fails), then
// each photo straight to Drive. Photo failures are reported per photo and can be retried
// without sending the story again.
import { STORY_KIND } from '@tamar70/shared'
import { api } from '../api/client.js'
import { photoYear } from '../lib/photoYear.js'
import { putToDrive, uploadPhoto, uploadType } from '../upload/uploadPhoto.js'
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
  const year = photoYear(photo.year)
  return {
    caption: photo.caption?.trim() || undefined,
    ...(year ? { year_approx: year } : {}),
    people: splitList(photo.people),
    sort_order: index,
  }
}

/** Runs `work(item, index)` for every item, at most `limit` at a time. */
export async function inPool(items, limit, work) {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      await work(items[index], index)
    }
  })
  await Promise.all(runners)
}

// Photos going up at the same time. More doesn't help a phone's upload speed.
export const PARALLEL_UPLOADS = 3

/**
 * Uploads a story's photos fast: one server call opens a Drive session for every photo, the
 * files go straight to Drive three at a time, and one more call confirms them all. A photo
 * whose session or confirmation fails falls back to the one-photo-at-a-time upload (with its
 * own retries), so nothing is lost.
 *
 * `onPhoto(key, patch)` receives { stage, progress } updates, then { stage: 'done' } or
 * { stage: 'error', error }. Resolves with the number of photos that failed.
 */
export async function uploadPhotos({
  storyId,
  editToken,
  photos,
  onPhoto,
  uploadImpl = uploadPhoto,
  putImpl = putToDrive,
  apiImpl = api,
  origin = window.location.origin,
  parallel = PARALLEL_UPLOADS,
}) {
  if (photos.length === 0) return 0
  let failed = 0
  const done = (photo) => onPhoto(photo.key, { stage: 'done', progress: 1 })
  const fail = (photo, error) => {
    failed++
    onPhoto(photo.key, { stage: 'error', error })
  }

  /** The careful path for one photo: a new session, retries, its own confirmation. */
  async function alone(photo, index) {
    try {
      await uploadImpl({
        file: photo.file,
        storyId,
        editToken,
        details: photoDetails(photo, index),
        onStage: (stage) => onPhoto(photo.key, { stage }),
        onProgress: (progress) => onPhoto(photo.key, { progress }),
      })
      done(photo)
    } catch (error) {
      fail(photo, error)
    }
  }

  photos.forEach((p) => onPhoto(p.key, { stage: 'starting' }))
  let sessions = []
  try {
    const { uploads } = await apiImpl.startUploads({
      story_id: storyId,
      edit_token: editToken,
      origin,
      files: photos.map((photo, index) => ({
        filename: photo.file.name,
        mime: uploadType(photo.file),
        bytes: photo.file.size,
        ...photoDetails(photo, index),
      })),
    })
    sessions = uploads
  } catch {
    // Every photo takes the careful path below.
  }

  const uploaded = [] // { photo, index, media_id, drive_file_id }
  await inPool(photos, parallel, async (photo, index) => {
    const session = sessions[index]
    if (!session?.upload_url) return alone(photo, index)
    try {
      onPhoto(photo.key, { stage: 'uploading', progress: 0 })
      const file = await putImpl(session.upload_url, photo.file, uploadType(photo.file), {
        onProgress: (progress) => onPhoto(photo.key, { progress }),
      })
      onPhoto(photo.key, { stage: 'confirming', progress: 1 })
      uploaded.push({ photo, index, media_id: session.media_id, drive_file_id: file.id })
    } catch {
      await alone(photo, index)
    }
  })

  if (uploaded.length) {
    let results = null
    try {
      ;({ results } = await apiImpl.finishUploads({
        story_id: storyId,
        edit_token: editToken,
        items: uploaded.map(({ media_id, drive_file_id }) => ({ media_id, drive_file_id })),
      }))
    } catch {
      results = null
    }
    for (const [i, item] of uploaded.entries()) {
      if (results?.[i]?.ok) {
        done(item.photo)
        continue
      }
      // Not confirmed together: confirm it alone, or upload it again from the start.
      try {
        await apiImpl.finishUpload({
          story_id: storyId,
          edit_token: editToken,
          media_id: item.media_id,
          drive_file_id: item.drive_file_id,
        })
        done(item.photo)
      } catch {
        await alone(item.photo, item.index)
      }
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
