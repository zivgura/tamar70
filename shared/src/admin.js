import { boolean, enum as oneOf, object, string } from 'zod'
import { LIMITS, SITE_STATUS, VISIBILITY } from './constants.js'
import { NOTIFY_MODE } from './tables.js'

// Admins sign in with Google on the site. The browser sends the Google ID token with every
// admin call; the server checks it with Google and looks the address up in AdminUsers.
// The client ID is public (it's in every sign-in page), not a secret.
export const GOOGLE_CLIENT_ID =
  '967060231980-vs7tjc1u1ucjv0tuo2a4qhcvom0k8vt4.apps.googleusercontent.com'
export const GOOGLE_ISSUERS = Object.freeze(['accounts.google.com', 'https://accounts.google.com'])

const idToken = string().min(100).max(4096)
const storyId = string().regex(/^st_[A-Za-z0-9]{6,40}$/)
const mediaId = string().regex(/^md_[A-Za-z0-9]{6,40}$/)
const text = (max) => string().trim().max(max)

export const adminAuthSchema = object({ id_token: idToken })
export const adminStorySchema = object({ id_token: idToken, id: storyId })
export const adminVisibilitySchema = object({
  id_token: idToken,
  id: storyId,
  visibility: oneOf([VISIBILITY.DEFAULT, VISIBILITY.HIDDEN, VISIBILITY.EARLY]),
})
export const adminStoryUpdateSchema = object({
  id_token: idToken,
  id: storyId,
  title: text(120),
  content: text(LIMITS.STORY_CONTENT_MAX),
  excerpt: text(300),
  author_name: text(60).min(1),
  author_relation: text(80),
  category_id: string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/),
  admin_notes: text(1000),
})
export const adminSettingsSchema = object({
  id_token: idToken,
  notify_mode: oneOf(Object.values(NOTIFY_MODE)).optional(),
  comments_open: boolean().optional(),
})
export const adminCommentSchema = object({
  id_token: idToken,
  comment_id: string().regex(/^cm_[A-Za-z0-9]{6,40}$/),
})
export const adminSiteStatusSchema = object({
  id_token: idToken,
  site_status: oneOf([SITE_STATUS.COLLECTING, SITE_STATUS.PUBLISHED]),
})
export const adminMediaSchema = object({ id_token: idToken, media_id: mediaId })
