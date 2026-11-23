import {
  ERROR_CODES,
  isDocumentMime,
  isPhotoMedia,
  MAX_DOCUMENTS_PER_STORY,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_STORY,
  mediaFinishManySchema,
  mediaFinishSchema,
  mediaStartManySchema,
  mediaStartSchema,
  safeFilename,
  UPLOAD_STATUS,
} from '@tamar70/shared'
import { ApiError } from './errors.js'
import { ownStory, requireSubmissionsOpen } from './ownership.js'
import { syncSharing } from './reveal.js'

// Public reads are cached for a minute; every write clears them.
export const PUBLIC_CACHE_KEYS = ['stories.list', 'site.bootstrap', 'gallery.list']
export const invalidatePublicCache = (ctx) => PUBLIC_CACHE_KEYS.forEach((k) => ctx.cache.remove(k))

export const mediaOf = (ctx, storyId) => ctx.db.all('Media').filter((m) => m.story_id === storyId)

/** Files of a story that count against its limits (not failed, not removed). */
function usedMedia(ctx, storyId) {
  return mediaOf(ctx, storyId).filter(
    (m) => m.upload_status !== UPLOAD_STATUS.FAILED && m.upload_status !== UPLOAD_STATUS.REMOVED,
  )
}

/** Throws if adding these files would pass the photo or document limit. */
function checkRoom(used, files) {
  const docs = files.filter((f) => isDocumentMime(f.mime)).length
  const photos = files.length - docs
  if (docs && used.filter((m) => !isPhotoMedia(m)).length + docs > MAX_DOCUMENTS_PER_STORY) {
    throw new ApiError(ERROR_CODES.TOO_MANY_PHOTOS, 'Too many documents for one story')
  }
  if (photos && used.filter(isPhotoMedia).length + photos > MAX_PHOTOS_PER_STORY) {
    throw new ApiError(
      ERROR_CODES.TOO_MANY_PHOTOS,
      `Up to ${MAX_PHOTOS_PER_STORY} photos per memory`,
    )
  }
}

/** The pending Media row for a file whose upload session is open. */
function pendingRow(ctx, story, mediaId, filename, file, sortOrder) {
  return {
    id: mediaId,
    story_id: story.id,
    drive_file_id: '',
    filename,
    mime: file.mime,
    bytes: file.bytes,
    caption: file.caption,
    year_approx: file.year_approx ?? null,
    people: file.people,
    place: file.place,
    sort_order: file.sort_order ?? sortOrder,
    upload_status: UPLOAD_STATUS.PENDING,
    is_shared: false,
    uploaded_at: ctx.now(),
  }
}

/**
 * Step 1 of a photo upload: checks the contributor may add a photo to this story, opens a
 * Drive upload session for exactly this file in the originals folder, and records a pending
 * Media row. The browser then sends the file straight to the returned URL.
 */
export function startUpload(ctx, payload) {
  const input = mediaStartSchema.parse(payload)
  requireSubmissionsOpen(ctx)
  const story = ownStory(ctx, input.story_id, input.edit_token)
  const used = usedMedia(ctx, story.id)
  checkRoom(used, [input])

  const mediaId = `md_${ctx.crypto.randomId(12)}`
  const filename = safeFilename(input.filename)

  let uploadUrl
  try {
    uploadUrl = ctx.drive.createUploadSession({
      name: `${mediaId}-${filename}`,
      mime: input.mime,
      bytes: input.bytes,
      origin: input.origin,
      properties: { media_id: mediaId, story_id: story.id },
    })
  } catch (err) {
    ctx.log.error(`Drive upload session failed: ${err && err.message}`)
    throw new ApiError(ERROR_CODES.UPLOAD_FAILED, 'Could not start the upload, try again')
  }

  ctx.lock.run(() => {
    ctx.db.insert('Media', pendingRow(ctx, story, mediaId, filename, input, used.length))
  })

  return { media_id: mediaId, upload_url: uploadUrl }
}

/**
 * Step 1 for several files in one call: one upload session each, opened in parallel.
 * Returns { uploads: [{ media_id, upload_url } or { error }] } in the order of `files`; a
 * file whose session failed can be started again on its own with media.start.
 */
export function startUploads(ctx, payload) {
  const input = mediaStartManySchema.parse(payload)
  requireSubmissionsOpen(ctx)
  const story = ownStory(ctx, input.story_id, input.edit_token)
  const used = usedMedia(ctx, story.id)
  checkRoom(used, input.files)

  const planned = input.files.map((file) => {
    const mediaId = `md_${ctx.crypto.randomId(12)}`
    return { file, mediaId, filename: safeFilename(file.filename) }
  })

  let urls
  try {
    urls = ctx.drive.createUploadSessions(
      planned.map(({ file, mediaId, filename }) => ({
        name: `${mediaId}-${filename}`,
        mime: file.mime,
        bytes: file.bytes,
        origin: input.origin,
        properties: { media_id: mediaId, story_id: story.id },
      })),
    )
  } catch (err) {
    ctx.log.error(`Drive upload sessions failed: ${err && err.message}`)
    throw new ApiError(ERROR_CODES.UPLOAD_FAILED, 'Could not start the uploads, try again')
  }

  ctx.lock.run(() => {
    planned.forEach(({ file, mediaId, filename }, i) => {
      if (urls[i]) {
        ctx.db.insert('Media', pendingRow(ctx, story, mediaId, filename, file, used.length + i))
      }
    })
  })

  return {
    uploads: planned.map(({ mediaId }, i) =>
      urls[i] ? { media_id: mediaId, upload_url: urls[i] } : { error: ERROR_CODES.UPLOAD_FAILED },
    ),
  }
}

/** Whether Drive's file is the one this media row's session was opened for. */
function isGenuine(ctx, media, file) {
  return Boolean(
    file &&
    (file.parents || []).includes(ctx.drive.folderId) &&
    file.appProperties?.media_id === media.id &&
    Number(file.size) > 0 &&
    Number(file.size) <= MAX_PHOTO_BYTES,
  )
}

/** Marks a media row done with Drive's file (inside the lock). */
function markDone(ctx, media, file) {
  ctx.db.update('Media', 'id', media.id, {
    drive_file_id: file.id,
    bytes: Number(file.size),
    mime: file.mimeType || media.mime,
    width: file.width ?? null,
    height: file.height ?? null,
    upload_status: UPLOAD_STATUS.DONE,
    uploaded_at: ctx.now(),
  })
}

function recountPhotos(ctx, story) {
  const done = mediaOf(ctx, story.id).filter(
    (m) => m.upload_status === UPLOAD_STATUS.DONE && isPhotoMedia(m),
  )
  ctx.db.update('Stories', 'id', story.id, { media_count: done.length, updated_at: ctx.now() })
}

/**
 * Step 2: the browser reports the Drive file it uploaded. The server checks with Drive that
 * this file really is the one it opened the session for (right folder, right media id, size
 * within the cap) before marking it done. Safe to repeat.
 */
export function finishUpload(ctx, payload) {
  const input = mediaFinishSchema.parse(payload)
  const story = ownStory(ctx, input.story_id, input.edit_token)

  const media = mediaOf(ctx, story.id).find((m) => m.id === input.media_id)
  if (!media) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Photo not found')
  if (media.upload_status === UPLOAD_STATUS.DONE) {
    if (media.drive_file_id === input.drive_file_id) {
      return { media_id: media.id, width: media.width, height: media.height, duplicate: true }
    }
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'This photo was already completed')
  }

  const file = ctx.drive.getFile(input.drive_file_id)
  if (!isGenuine(ctx, media, file)) {
    throw new ApiError(ERROR_CODES.UPLOAD_FAILED, 'The uploaded file could not be verified')
  }

  const result = ctx.lock.run(() => {
    markDone(ctx, media, file)
    recountPhotos(ctx, story)
    return { media_id: media.id, width: file.width ?? null, height: file.height ?? null }
  })

  // A photo added to a story that's already open (after the reveal) is shared right away.
  syncSharing(ctx, { storyId: story.id })
  invalidatePublicCache(ctx)
  return result
}

/**
 * Step 2 for several files in one call. Each item is checked with Drive like finishUpload;
 * returns { results: [{ media_id, ok: true, ... } or { media_id, ok: false, error }] } so the
 * browser can confirm a failed one again on its own.
 */
export function finishUploads(ctx, payload) {
  const input = mediaFinishManySchema.parse(payload)
  const story = ownStory(ctx, input.story_id, input.edit_token)
  const rows = mediaOf(ctx, story.id)

  const toCheck = []
  const results = input.items.map(({ media_id, drive_file_id }) => {
    const media = rows.find((m) => m.id === media_id)
    if (!media) return { media_id, ok: false, error: ERROR_CODES.NOT_FOUND }
    if (media.upload_status === UPLOAD_STATUS.DONE) {
      return media.drive_file_id === drive_file_id
        ? { media_id, ok: true, width: media.width, height: media.height, duplicate: true }
        : { media_id, ok: false, error: ERROR_CODES.FORBIDDEN }
    }
    toCheck.push({ media, drive_file_id })
    return null
  })

  const files = toCheck.length ? ctx.drive.getFiles(toCheck.map((c) => c.drive_file_id)) : []
  const verified = toCheck.map((c, i) => ({ ...c, file: files[i] }))

  ctx.lock.run(() => {
    for (const { media, file } of verified) {
      if (isGenuine(ctx, media, file)) markDone(ctx, media, file)
    }
    recountPhotos(ctx, story)
  })

  let next = 0
  const out = results.map((r) => {
    if (r) return r
    const { media, file } = verified[next++]
    return isGenuine(ctx, media, file)
      ? { media_id: media.id, ok: true, width: file.width ?? null, height: file.height ?? null }
      : { media_id: media.id, ok: false, error: ERROR_CODES.UPLOAD_FAILED }
  })

  syncSharing(ctx, { storyId: story.id })
  invalidatePublicCache(ctx)
  return { results: out }
}
