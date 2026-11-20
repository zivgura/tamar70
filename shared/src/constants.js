// Enum values from the spec's data model. Keep these in sync with the Sheet.

export const SITE_STATUS = Object.freeze({
  COLLECTING: 'collecting',
  PUBLISHED: 'published',
})

export const STORY_KIND = Object.freeze({
  TEXT: 'text',
  PHOTOS: 'photos',
  MIXED: 'mixed',
})

export const STORY_STATUS = Object.freeze({
  ACTIVE: 'active',
  DELETED: 'deleted',
})

// Per-story override of the site mode.
export const VISIBILITY = Object.freeze({
  DEFAULT: 'default',
  HIDDEN: 'hidden',
  EARLY: 'early',
})

export const COMMENT_STATUS = Object.freeze({
  VISIBLE: 'visible',
  DELETED: 'deleted',
})

export const UPLOAD_STATUS = Object.freeze({
  PENDING: 'pending',
  DONE: 'done',
  FAILED: 'failed',
})

export const DEFAULT_CATEGORY_ID = 'general'

// A category's accent is a tone name from the design system (web/src/theme/tokens.css),
// never a color value. The Sheet's Categories.color column holds one of these.
export const CATEGORY_TONES = Object.freeze(['rose', 'sage', 'terracotta', 'sand'])
export const DEFAULT_TONE = 'sand'

export const LIMITS = Object.freeze({
  STORY_CONTENT_MAX: 10_000,
  COMMENT_CONTENT_MAX: 1_000,
})
