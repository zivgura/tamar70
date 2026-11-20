import {
  ERROR_CODES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_STORY,
  mediaFinishSchema,
  mediaStartSchema,
  safeFilename,
  UPLOAD_STATUS,
} from '@tamar70/shared'
import { ApiError } from './errors.js'
import { ownStory, requireSubmissionsOpen } from './ownership.js'

// Public reads are cached for a minute; every write clears them.
export const PUBLIC_CACHE_KEYS = ['stories.list', 'site.bootstrap']
export const invalidatePublicCache = (ctx) => PUBLIC_CACHE_KEYS.forEach((k) => ctx.cache.remove(k))

export const mediaOf = (ctx, storyId) => ctx.db.all('Media').filter((m) => m.story_id === storyId)

/**
 * Step 1 of a photo upload: checks the contributor may add a photo to this story, opens a
 * Drive upload session for exactly this file in the originals folder, and records a pending
 * Media row. The browser then sends the file straight to the returned URL.
 */
export function startUpload(ctx, payload) {
  const input = mediaStartSchema.parse(payload)
  requireSubmissionsOpen(ctx)
  const story = ownStory(ctx, input.story_id, input.edit_token)

  const used = mediaOf(ctx, story.id).filter(
    (m) => m.upload_status !== UPLOAD_STATUS.FAILED && m.upload_status !== UPLOAD_STATUS.REMOVED,
  )
  if (used.length >= MAX_PHOTOS_PER_STORY) {
    throw new ApiError(
      ERROR_CODES.TOO_MANY_PHOTOS,
      `Up to ${MAX_PHOTOS_PER_STORY} photos per memory`,
    )
  }

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
    ctx.db.insert('Media', {
      id: mediaId,
      story_id: story.id,
      drive_file_id: '',
      filename,
      mime: input.mime,
      bytes: input.bytes,
      caption: input.caption,
      year_approx: input.year_approx ?? null,
      people: input.people,
      place: input.place,
      sort_order: input.sort_order ?? used.length,
      upload_status: UPLOAD_STATUS.PENDING,
      is_shared: false,
      uploaded_at: ctx.now(),
    })
  })

  return { media_id: mediaId, upload_url: uploadUrl }
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
  const genuine =
    file &&
    (file.parents || []).includes(ctx.drive.folderId) &&
    file.appProperties?.media_id === media.id &&
    Number(file.size) > 0 &&
    Number(file.size) <= MAX_PHOTO_BYTES
  if (!genuine) {
    throw new ApiError(ERROR_CODES.UPLOAD_FAILED, 'The uploaded file could not be verified')
  }

  const result = ctx.lock.run(() => {
    ctx.db.update('Media', 'id', media.id, {
      drive_file_id: file.id,
      bytes: Number(file.size),
      mime: file.mimeType || media.mime,
      width: file.width ?? null,
      height: file.height ?? null,
      upload_status: UPLOAD_STATUS.DONE,
      uploaded_at: ctx.now(),
    })
    const done = mediaOf(ctx, story.id).filter((m) => m.upload_status === UPLOAD_STATUS.DONE)
    ctx.db.update('Stories', 'id', story.id, { media_count: done.length, updated_at: ctx.now() })
    return { media_id: media.id, width: file.width ?? null, height: file.height ?? null }
  })

  invalidatePublicCache(ctx)
  return result
}
