import { describe, expect, it } from 'vitest'
import { makeExcerpt, toPublicStory } from './stories.js'
import { STORY_VIEW } from './visibility.js'

describe('makeExcerpt', () => {
  it('takes the first sentence', () => {
    expect(makeExcerpt('זה היה בקיץ 1975. ואז הכול השתנה.')).toBe('זה היה בקיץ 1975.')
  })

  it('collapses whitespace and line breaks', () => {
    expect(makeExcerpt('  שורה ראשונה\n\nשורה שנייה')).toBe('שורה ראשונה שורה שנייה')
  })

  it('cuts a long sentence at a word boundary', () => {
    const excerpt = makeExcerpt('מילה '.repeat(60))
    expect(excerpt.length).toBeLessThanOrEqual(141)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt).not.toMatch(/מיל…$/)
  })

  it('returns empty for no content', () => {
    expect(makeExcerpt('')).toBe('')
    expect(makeExcerpt(undefined)).toBe('')
  })
})

describe('toPublicStory', () => {
  const story = {
    id: 'st_1',
    title: 'T',
    excerpt: 'E',
    content: 'secret full text',
    edit_token_hash: 'h',
    admin_notes: 'n',
  }

  it('never includes content in a teaser', () => {
    const teaser = toPublicStory(story, STORY_VIEW.TEASER)
    expect(teaser).toMatchObject({ id: 'st_1', view: 'teaser', excerpt: 'E' })
    expect(teaser).not.toHaveProperty('content')
  })

  it('never includes private fields', () => {
    const full = toPublicStory(story, STORY_VIEW.FULL)
    expect(full.content).toBe('secret full text')
    for (const f of ['edit_token_hash', 'admin_notes']) {
      expect(full).not.toHaveProperty(f)
    }
  })

  it('returns null when the story must not be shown', () => {
    expect(toPublicStory(story, STORY_VIEW.NONE)).toBeNull()
  })
})
