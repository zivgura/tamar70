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
      editToken: 'tok',
    })
    expect(payload).toEqual({
      edit_token: 'tok',
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
  it('reports each photo and counts failures', async () => {
    const photos = [
      { key: 1, file: { name: 'a.jpg', type: 'image/jpeg', size: 1 }, caption: 'א' },
      { key: 2, file: { name: 'b.jpg', type: 'image/jpeg', size: 1 } },
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
      apiImpl: { startUploads: vi.fn().mockRejectedValue(new Error('offline')) },
      origin: 'https://tamar70.web.app',
      onPhoto: (key, patch) => updates.push([key, patch]),
    })
    expect(failed).toBe(1)
    expect(uploadImpl.mock.calls[0][0]).toMatchObject({
      file: { name: 'a.jpg' },
      storyId: 'st_1',
      details: { caption: 'א', sort_order: 0 },
    })
    expect(updates).toContainEqual([1, { stage: 'done', progress: 1 }])
    expect(updates.at(-1)).toEqual([2, { stage: 'error', error: expect.any(Error) }])
  })
})

describe('uploadPhotos, all at once', () => {
  const file = (name) => ({ name, type: 'image/jpeg', size: 1000 })
  const photos = [
    { key: 1, file: file('a.jpg'), caption: 'א' },
    { key: 2, file: file('b.jpg') },
    { key: 3, file: file('c.jpg') },
    { key: 4, file: file('d.jpg') },
  ]
  const sessions = photos.map((_, i) => ({ media_id: `md_${i}`, upload_url: `https://up/${i}` }))

  it('opens every session in one call, uploads 3 at a time, confirms in one call', async () => {
    let running = 0
    let most = 0
    const putImpl = vi.fn(async (url, f, type, { onProgress }) => {
      most = Math.max(most, ++running)
      await new Promise((r) => setTimeout(r, 5))
      onProgress(1)
      running--
      return { id: `drive_${url.slice(-1)}` }
    })
    const apiImpl = {
      startUploads: vi.fn().mockResolvedValue({ uploads: sessions }),
      finishUploads: vi.fn(async ({ items }) => ({
        results: items.map((i) => ({ media_id: i.media_id, ok: true })),
      })),
      finishUpload: vi.fn(),
    }
    const uploadImpl = vi.fn()
    const updates = []
    const failed = await uploadPhotos({
      storyId: 'st_1',
      editToken: 't',
      photos,
      putImpl,
      apiImpl,
      uploadImpl,
      origin: 'https://tamar70.web.app',
      onPhoto: (key, patch) => updates.push([key, patch]),
    })

    expect(failed).toBe(0)
    expect(apiImpl.startUploads).toHaveBeenCalledTimes(1)
    expect(apiImpl.startUploads.mock.calls[0][0].files[0]).toMatchObject({
      filename: 'a.jpg',
      mime: 'image/jpeg',
      bytes: 1000,
      caption: 'א',
      sort_order: 0,
    })
    expect(most).toBe(3)
    expect(apiImpl.finishUploads).toHaveBeenCalledTimes(1)
    expect(apiImpl.finishUploads.mock.calls[0][0].items).toHaveLength(4)
    expect(apiImpl.finishUpload).not.toHaveBeenCalled()
    expect(uploadImpl).not.toHaveBeenCalled()
    for (const p of photos) expect(updates).toContainEqual([p.key, { stage: 'done', progress: 1 }])
  })

  it('falls back to one photo at a time for a failed session, upload or confirmation', async () => {
    const apiImpl = {
      startUploads: vi.fn().mockResolvedValue({
        uploads: [{ error: 'upload_failed' }, sessions[1], sessions[2], sessions[3]],
      }),
      finishUploads: vi.fn().mockResolvedValue({
        results: [
          { media_id: 'md_2', ok: true },
          { media_id: 'md_3', ok: false, error: 'upload_failed' },
        ],
      }),
      // md_3 can't be confirmed alone either: it goes up again from the start.
      finishUpload: vi.fn().mockRejectedValue(new Error('still no')),
    }
    const putImpl = vi.fn(async (url) => {
      if (url.endsWith('/1')) throw new Error('dropped')
      return { id: `drive_${url.slice(-1)}` }
    })
    const uploadImpl = vi.fn().mockResolvedValue({})
    const failed = await uploadPhotos({
      storyId: 'st_1',
      editToken: 't',
      photos,
      putImpl,
      apiImpl,
      uploadImpl,
      origin: 'https://tamar70.web.app',
      onPhoto: () => {},
    })
    expect(failed).toBe(0)
    // a.jpg (no session), b.jpg (upload dropped) and d.jpg (not confirmed) went the careful way.
    expect(uploadImpl.mock.calls.map((c) => c[0].file.name).sort()).toEqual([
      'a.jpg',
      'b.jpg',
      'd.jpg',
    ])
  })

  it('takes the careful path for everything when the batch call fails', async () => {
    const apiImpl = { startUploads: vi.fn().mockRejectedValue(new Error('busy')) }
    const uploadImpl = vi.fn().mockResolvedValue({})
    await uploadPhotos({
      storyId: 'st_1',
      editToken: 't',
      photos,
      apiImpl,
      uploadImpl,
      origin: 'https://tamar70.web.app',
      onPhoto: () => {},
    })
    expect(uploadImpl).toHaveBeenCalledTimes(4)
  })
})
