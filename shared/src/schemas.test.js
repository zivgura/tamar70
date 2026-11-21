import { describe, expect, it } from 'vitest'
import { storySubmissionSchema } from './schemas.js'

const valid = {
  edit_token: 'tok_0123456789abcdefghijklmnopqrstuv',
  kind: 'text',
  author_name: '  ענת ',
  content: 'סיפור',
}

describe('storySubmissionSchema', () => {
  it('accepts a minimal text story and fills defaults', () => {
    const s = storySubmissionSchema.parse(valid)
    expect(s.author_name).toBe('ענת')
    expect(s.category_id).toBe('general')
    expect(s.title).toBe('')
    expect(s.places).toEqual([])
  })

  it('requires content unless photos only', () => {
    expect(storySubmissionSchema.safeParse({ ...valid, content: ' ' }).success).toBe(false)
    expect(storySubmissionSchema.safeParse({ ...valid, kind: 'photos', content: '' }).success).toBe(
      true,
    )
  })

  it('rejects a filled honeypot', () => {
    expect(storySubmissionSchema.safeParse({ ...valid, website: 'spam.com' }).success).toBe(false)
  })

  it('caps the story length', () => {
    const long = 'א'.repeat(10_001)
    expect(storySubmissionSchema.safeParse({ ...valid, content: long }).success).toBe(false)
  })

  it('only accepts whole decades', () => {
    expect(storySubmissionSchema.safeParse({ ...valid, decade: 1975 }).success).toBe(false)
    expect(storySubmissionSchema.safeParse({ ...valid, decade: 1970 }).success).toBe(true)
  })

  it('rejects a malformed category id', () => {
    expect(storySubmissionSchema.safeParse({ ...valid, category_id: 'Bad Id!' }).success).toBe(
      false,
    )
  })
})
