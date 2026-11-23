import { DEFAULT_CATEGORY_ID, VISIBILITY } from '@tamar70/shared'

// The last chapter: stories that are only photos, together, after the written ones.
export const ALBUM = {
  id: 'album',
  name: 'אלבום התמונות',
  description: 'תמונות ששיתפו בלי מילים',
  tone: 'sand',
}

const hasWords = (s) => Boolean(String(s.content ?? '').trim())
const hasPhotos = (s) => s.photos.some((p) => p.image)
const byDate = (a, b) => String(a.created_at).localeCompare(String(b.created_at))

/**
 * The corners in order, each with its written stories (oldest first), then the album of
 * photo-only stories. Empty chapters are left out.
 */
export function bookChapters({ stories, categories }) {
  const shown = stories.filter((s) => s.visibility !== VISIBILITY.HIDDEN)
  const known = new Set(categories.map((c) => c.id))
  const chapterOf = (s) => (known.has(s.category_id) ? s.category_id : DEFAULT_CATEGORY_ID)
  const written = shown.filter(hasWords)
  const corners = categories.map((category) => ({
    category,
    stories: written.filter((s) => chapterOf(s) === category.id).sort(byDate),
  }))
  const album = {
    category: ALBUM,
    stories: shown.filter((s) => !hasWords(s) && hasPhotos(s)).sort(byDate),
    album: true,
  }
  return [...corners, album].filter((chapter) => chapter.stories.length > 0)
}
