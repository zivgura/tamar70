// A contributor's own story, from the device that sent it (proven by its edit token):
// read it back in full, change it, delete it, and manage its photos. Only while collecting.
import {
  DEFAULT_CATEGORY_ID,
  makeExcerpt,
  mediaRemoveSchema,
  mediaUpdateSchema,
  ownStorySchema,
  STORY_STATUS,
  storyUpdateSchema,
  UPLOAD_STATUS,
  ERROR_CODES,
} from '@tamar70/shared'
import { ApiError } from './errors.js'
import { invalidatePublicCache, mediaOf } from './media.js'
import { ownStory, requireEditable } from './ownership.js'

export const livePhotos = (ctx, storyId) =>
  mediaOf(ctx, storyId)
    .filter((m) => m.upload_status === UPLOAD_STATUS.DONE)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

function ownMedia(ctx, story, mediaId) {
  const media = mediaOf(ctx, story.id).find((m) => m.id === mediaId)
  if (!media || media.upload_status === UPLOAD_STATUS.REMOVED) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Photo not found')
  }
  return media
}

export function recountPhotos(ctx, story) {
  ctx.db.update('Stories', 'id', story.id, {
    media_count: livePhotos(ctx, story.id).length,
    updated_at: ctx.now(),
  })
}

/** The whole story as written, with its photos (small thumbnails: they're private in Drive). */
export function getOwnStory(ctx, payload) {
  const { id, edit_token } = ownStorySchema.parse(payload)
  requireEditable(ctx)
  const story = ownStory(ctx, id, edit_token)
  const photos = livePhotos(ctx, story.id).map((m) => ({
    id: m.id,
    filename: m.filename,
    caption: m.caption,
    year_approx: m.year_approx,
    people: m.people,
    place: m.place,
    thumbnail: m.drive_file_id ? ctx.drive.thumbnail(m.drive_file_id) : null,
  }))
  return {
    id: story.id,
    kind: story.kind,
    title: story.title,
    content: story.content,
    author_name: story.author_name,
    author_relation: story.author_relation,
    category_id: story.category_id || DEFAULT_CATEGORY_ID,
    decade: story.decade,
    places: story.places,
    people: story.people,
    created_at: story.created_at,
    photos,
  }
}

export function updateOwnStory(ctx, payload) {
  const input = storyUpdateSchema.parse(payload)
  requireEditable(ctx)
  const story = ownStory(ctx, input.id, input.edit_token)
  const known = new Set(ctx.db.all('Categories').map((c) => c.id))

  ctx.lock.run(() => {
    ctx.db.update('Stories', 'id', story.id, {
      kind: input.kind,
      title: input.title,
      content: input.content,
      excerpt: makeExcerpt(input.content),
      author_name: input.author_name,
      author_relation: input.author_relation,
      category_id: known.has(input.category_id) ? input.category_id : DEFAULT_CATEGORY_ID,
      decade: input.decade ?? null,
      year_approx: input.year_approx ?? null,
      places: input.places,
      people: input.people,
      tags: input.tags,
      updated_at: ctx.now(),
    })
  })
  invalidatePublicCache(ctx)
  return { id: story.id }
}

/** Soft delete: the row stays (status deleted) and its photos go to the Drive trash. */
export function deleteOwnStory(ctx, payload) {
  const { id, edit_token } = ownStorySchema.parse(payload)
  requireEditable(ctx)
  const story = ownStory(ctx, id, edit_token)
  const photos = mediaOf(ctx, story.id).filter((m) => m.upload_status !== UPLOAD_STATUS.REMOVED)

  ctx.lock.run(() => {
    ctx.db.update('Stories', 'id', story.id, {
      status: STORY_STATUS.DELETED,
      updated_at: ctx.now(),
    })
    for (const m of photos) {
      ctx.db.update('Media', 'id', m.id, { upload_status: UPLOAD_STATUS.REMOVED })
    }
  })
  for (const m of photos) trashQuietly(ctx, m.drive_file_id)
  invalidatePublicCache(ctx)
  return { id: story.id, deleted: true }
}

export function updateOwnMedia(ctx, payload) {
  const input = mediaUpdateSchema.parse(payload)
  requireEditable(ctx)
  const story = ownStory(ctx, input.story_id, input.edit_token)
  const media = ownMedia(ctx, story, input.media_id)
  ctx.lock.run(() => {
    ctx.db.update('Media', 'id', media.id, {
      caption: input.caption,
      place: input.place,
      year_approx: input.year_approx ?? null,
      people: input.people,
    })
  })
  return { media_id: media.id }
}

export function removeOwnMedia(ctx, payload) {
  const input = mediaRemoveSchema.parse(payload)
  requireEditable(ctx)
  const story = ownStory(ctx, input.story_id, input.edit_token)
  const media = ownMedia(ctx, story, input.media_id)
  ctx.lock.run(() => {
    ctx.db.update('Media', 'id', media.id, { upload_status: UPLOAD_STATUS.REMOVED })
    recountPhotos(ctx, story)
  })
  trashQuietly(ctx, media.drive_file_id)
  invalidatePublicCache(ctx)
  return { media_id: media.id, removed: true }
}

// The Media row is what the site goes by; a file that can't be trashed now is cleaned up later.
export function trashQuietly(ctx, fileId) {
  if (!fileId) return
  try {
    ctx.drive.trash(fileId)
  } catch (err) {
    ctx.log.error(`Could not trash ${fileId}: ${err && err.message}`)
  }
}
