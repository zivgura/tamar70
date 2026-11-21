import { object, string } from 'zod'

// Comments open with the reveal: a name and a few words under a story shown in full.
export const COMMENT_MAX = 1000

const storyId = string().regex(/^st_[A-Za-z0-9]{6,40}$/)

export const commentSchema = object({
  story_id: storyId,
  author_name: string().trim().min(1).max(60),
  content: string().trim().min(1).max(COMMENT_MAX),
  website: string().max(0, 'honeypot').optional(),
})

/** What the public sees of a comment. */
export function toPublicComment(c) {
  return { id: c.id, author_name: c.author_name, content: c.content, created_at: c.created_at }
}
