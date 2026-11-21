// Comments under stories, once a story is shown in full and comments are open (they open
// with the reveal). Public, so capped per hour; admins can delete any of them.
import {
  COMMENT_STATUS,
  commentSchema,
  ERROR_CODES,
  getStoryView,
  STORY_VIEW,
  toPublicComment,
} from '@tamar70/shared'
import { ApiError, notFound } from './errors.js'
import { invalidatePublicCache } from './media.js'
import { readSettings, siteConfig } from './settings.js'
import { underHourlyLimit } from './telemetry.js'

export const COMMENTS_PER_HOUR = 120

const byOldest = (a, b) => String(a.created_at).localeCompare(String(b.created_at))

/** A story's live comments, oldest first, as the public sees them. */
export function commentsOf(ctx, storyId) {
  return ctx.db
    .all('Comments')
    .filter((c) => c.story_id === storyId && c.status === COMMENT_STATUS.VISIBLE)
    .sort(byOldest)
    .map(toPublicComment)
}

/** Map(storyId → number of live comments), for the story cards. */
export function commentCounts(ctx) {
  const counts = new Map()
  for (const c of ctx.db.all('Comments')) {
    if (c.status === COMMENT_STATUS.VISIBLE)
      counts.set(c.story_id, (counts.get(c.story_id) ?? 0) + 1)
  }
  return counts
}

export function addComment(ctx, payload) {
  // A filled hidden field means a bot: answer as if it worked, save nothing.
  if (typeof payload?.website === 'string' && payload.website.trim() !== '') {
    return { id: 'cm_ignored', author_name: '', content: '', created_at: ctx.now() }
  }
  const input = commentSchema.parse(payload)
  const config = siteConfig(readSettings(ctx.db))
  const story = ctx.db.all('Stories').find((s) => s.id === input.story_id)
  if (!story || getStoryView(story, config.site_status) === null) throw notFound('Story not found')
  if (!config.comments_open || getStoryView(story, config.site_status) !== STORY_VIEW.FULL) {
    throw new ApiError(ERROR_CODES.COMMENTS_CLOSED, 'Comments are not open for this story')
  }
  if (!underHourlyLimit(ctx, 'comments', COMMENTS_PER_HOUR)) {
    throw new ApiError(ERROR_CODES.BUSY, 'Too many comments this hour, try again later')
  }
  const comment = {
    id: `cm_${ctx.crypto.randomId(12)}`,
    story_id: story.id,
    author_name: input.author_name,
    content: input.content,
    created_at: ctx.now(),
    status: COMMENT_STATUS.VISIBLE,
  }
  ctx.lock.run(() => ctx.db.insert('Comments', comment))
  invalidatePublicCache(ctx)
  return toPublicComment(comment)
}
