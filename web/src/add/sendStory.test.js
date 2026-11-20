import { describe, expect, it, vi } from 'vitest'
import { EMPTY_DRAFT, splitList } from './deviceStore.js'
import { photoDetails, storyKind, submission, uploadPhotos } from './sendStory.js'

describe('storyKind', () => {
  it('follows what was actually filled in', () => {
    expect(storyKind('טקסט', 0)).toBe('text')
    expect(storyKind('טקסט', 2)).toBe('mixed')
    expect(storyKind('   ', 2)).toBe('photos')
  })
})

describe('submission', () => {
  it('builds the API payload from the draft', () => {
    const payload = submission({
      draft: {
        ...EMPTY_DRAFT,
        kind: 'mixed',
        category_id: 'travels',
        title: ' הטרמפ לאילת ',
        content: 'זה היה בקיץ.',
        decade: 1970,
        place: 'אילת, הערבה',
        people: 'ענת',
      },
      author: { name: ' רונית ', relation: 'חברה' },
      photos: [{}],
      familyCode: 'abc',
      editToken: 'tok',
    })
    expect(payload).toEqual({
      edit_token: 'tok',
      family_code: 'abc',
      kind: 'mixed',
      author_name: 'רונית',
      author_relation: 'חברה',
      title: 'הטרמפ לאילת',
      content: 'זה היה בקיץ.',
      category_id: 'travels',
      decade: 1970,
      places: ['אילת', 'הערבה'],
      people: ['ענת'],
    })
  })

  it('leaves out an unset decade and corner', () => {
    const payload = submission({
      draft: { ...EMPTY_DRAFT, content: 'x' },
      author: { name: 'a', relation: '' },
      photos: [],
      familyCode: 'c',
      editToken: 't',
    })
    expect(payload).not.toHaveProperty('decade')
    expect(payload.category_id).toBeUndefined()
  })
})

describe('splitList / photoDetails', () => {
  it('splits names on commas and new lines', () => {
    expect(splitList('אבא, אמא\nסבתא, ,')).toEqual(['אבא', 'אמא', 'סבתא'])
  })

  it('keeps only a plausible year', () => {
    expect(photoDetails({ year: '1975', caption: ' בים ' }, 2)).toEqual({
      caption: 'בים',
      year_approx: 1975,
      people: [],
      sort_order: 2,
    })
    expect(photoDetails({ year: 'שנות ה-70' }, 0)).not.toHaveProperty('year_approx')
  })
})

describe('uploadPhotos', () => {
  it('uploads in order, reports each photo, and counts failures', async () => {
    const photos = [
      { key: 1, file: 'a', caption: 'א' },
      { key: 2, file: 'b' },
    ]
    const uploadImpl = vi
      .fn()
      .mockImplementationOnce(async ({ onStage, onProgress }) => {
        onStage('uploading')
        onProgress(0.5)
      })
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'network' }))
    const updates = []
    const failed = await uploadPhotos({
      storyId: 'st_1',
      editToken: 't',
      photos,
      uploadImpl,
      onPhoto: (key, patch) => updates.push([key, patch]),
    })
    expect(failed).toBe(1)
    expect(uploadImpl.mock.calls[0][0]).toMatchObject({
      file: 'a',
      storyId: 'st_1',
      details: { caption: 'א', sort_order: 0 },
    })
    expect(updates).toContainEqual([1, { stage: 'done', progress: 1 }])
    expect(updates.at(-1)).toEqual([2, { stage: 'error', error: expect.any(Error) }])
  })
})
