import { STORY_VIEW } from './visibility.js'

const EXCERPT_MAX = 140

/**
 * The teaser shown in collecting mode: the first sentence (or line), capped in length.
 * Admins can edit it afterwards if it gives away too much.
 */
export function makeExcerpt(content) {
  const text = String(content ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  const match = text.match(/^.+?[.!?…](?=\s|$)/)
  const sentence = match ? match[0] : text
  if (sentence.length <= EXCERPT_MAX) return sentence
  const cut = sentence.slice(0, EXCERPT_MAX)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > EXCERPT_MAX / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

const TEASER_FIELDS = [
  'id',
  'kind',
  'title',
  'excerpt',
  'author_name',
  'author_relation',
  'category_id',
  'media_count',
  'created_at',
]

const FULL_FIELDS = [
  ...TEASER_FIELDS,
  'content',
  'decade',
  'year_approx',
  'places',
  'people',
  'tags',
  'featured',
  'updated_at',
]

/**
 * Only the fields the public may see for the given view. Anything not listed here
 * (content in collecting mode, edit token hashes, admin notes) never leaves the server.
 */
export function toPublicStory(story, view) {
  const fields =
    view === STORY_VIEW.FULL ? FULL_FIELDS : view === STORY_VIEW.TEASER ? TEASER_FIELDS : null
  if (!fields) return null
  const out = { view }
  for (const f of fields) out[f] = story[f]
  return out
}
