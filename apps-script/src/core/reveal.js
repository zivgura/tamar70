// The reveal: which photos are open to anyone with the link, and the public photo lists.
// A photo is shared exactly while its story is shown in full (the site is published, or an
// admin opened that story early) and isn't hidden. Changing Drive sharing takes a moment per
// file, so it's done in batches: right away for a few, the rest by the 15-minute timer.
import {
  STORY_STATUS,
  STORY_VIEW,
  getStoryView,
  toPublicPhoto,
  UPLOAD_STATUS,
} from '@tamar70/shared'
import { readSettings, siteConfig } from './settings.js'

export const SHARE_BATCH = 120

const isLive = (m) => m.upload_status === UPLOAD_STATUS.DONE && m.drive_file_id

function storiesById(ctx) {
  return new Map(ctx.db.all('Stories').map((s) => [s.id, s]))
}

/** For each live photo: should it be shared right now? */
function wanted(ctx) {
  const status = siteConfig(readSettings(ctx.db)).site_status
  const stories = storiesById(ctx)
  return ctx.db
    .all('Media')
    .filter(isLive)
    .map((m) => {
      const story = stories.get(m.story_id)
      const want = Boolean(story) && getStoryView(story, status) === STORY_VIEW.FULL
      return { media: m, want }
    })
}

/** How far the sharing is: photos that should be open, and how many already are. */
export function sharingProgress(ctx) {
  const list = wanted(ctx)
  const shouldBe = list.filter((x) => x.want)
  return {
    shared: shouldBe.filter((x) => x.media.is_shared).length,
    total: shouldBe.length,
    // Photos still open that shouldn't be (after going back to collecting, or hiding).
    to_close: list.filter((x) => !x.want && x.media.is_shared).length,
  }
}

/** Shares or un-shares up to `limit` photos whose sharing doesn't match. Returns how many. */
export function syncSharing(ctx, { limit = SHARE_BATCH, storyId = null } = {}) {
  const todo = wanted(ctx)
    .filter((x) => !storyId || x.media.story_id === storyId)
    .filter((x) => x.want !== Boolean(x.media.is_shared))
    .slice(0, limit)
  let changed = 0
  for (const { media, want } of todo) {
    try {
      ctx.drive.setPublic(media.drive_file_id, want)
      ctx.db.update('Media', 'id', media.id, { is_shared: want })
      changed++
    } catch (err) {
      ctx.log.error(`Could not change sharing of ${media.id}: ${err && err.message}`)
    }
  }
  return changed
}

/** The shared photos of each story, in order: Map(storyId → photos). */
export function sharedPhotosByStory(ctx) {
  const out = new Map()
  ctx.db
    .all('Media')
    .filter((m) => isLive(m) && m.is_shared)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((m) => {
      if (!out.has(m.story_id)) out.set(m.story_id, [])
      out.get(m.story_id).push(toPublicPhoto(m))
    })
  return out
}

/** The gallery: every shared photo of a story shown in full, newest stories first. */
export function galleryPhotos(ctx) {
  const status = siteConfig(readSettings(ctx.db)).site_status
  const photos = sharedPhotosByStory(ctx)
  return ctx.db
    .all('Stories')
    .filter((s) => s.status === STORY_STATUS.ACTIVE)
    .filter((s) => getStoryView(s, status) === STORY_VIEW.FULL)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .flatMap((s) =>
      (photos.get(s.id) ?? []).map((p) => ({
        ...p,
        story_id: s.id,
        story_title: s.title || s.excerpt || '',
        author_name: s.author_name,
      })),
    )
}
