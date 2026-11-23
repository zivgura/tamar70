import { describe, expect, it } from 'vitest'
import { ALBUM, bookChapters } from './bookChapters.js'

const categories = [
  { id: 'travels', name: 'טיולים' },
  { id: 'general', name: 'כללי' },
  { id: 'words', name: 'כמה מילים' },
]
const story = (id, o = {}) => ({
  id,
  content: 'סיפור',
  category_id: 'travels',
  visibility: 'default',
  created_at: `2026-12-0${id}T10:00:00Z`,
  photos: [],
  ...o,
})

describe('bookChapters', () => {
  it('orders by corner, oldest first, skips hidden and empty corners, photos-only last', () => {
    const chapters = bookChapters({
      categories,
      stories: [
        story('3', { category_id: 'general' }),
        story('2'),
        story('1'),
        story('4', { visibility: 'hidden' }),
        story('5', { category_id: 'gone' }),
        story('6', { content: '  ', photos: [{ image: 'https://img/x' }] }),
        story('7', { content: '', photos: [{ image: null }] }),
      ],
    })
    expect(chapters.map((c) => c.category.id)).toEqual(['travels', 'general', ALBUM.id])
    expect(chapters[0].stories.map((s) => s.id)).toEqual(['1', '2'])
    expect(chapters[1].stories.map((s) => s.id)).toEqual(['3', '5'])
    expect(chapters[2].album).toBe(true)
    expect(chapters[2].stories.map((s) => s.id)).toEqual(['6'])
  })
})
