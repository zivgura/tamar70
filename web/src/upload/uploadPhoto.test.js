import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.js'
import { photoType, rejectReason, uploadPhoto } from './uploadPhoto.js'

const photo = (name = 'IMG_1.JPG', type = 'image/jpeg', size = 1000) => {
  const f = new File([new Uint8Array(size)], name, { type })
  return f
}

function fakeApi() {
  let n = 0
  return {
    startUpload: vi.fn(async () => ({ media_id: `md_${++n}aaaaaa`, upload_url: `https://u/${n}` })),
    finishUpload: vi.fn(async ({ media_id }) => ({ media_id, width: 10, height: 10 })),
  }
}

const base = (overrides) => ({
  file: photo(),
  storyId: 'st_abcdef12',
  editToken: 'e'.repeat(40),
  origin: 'https://tamar70.web.app',
  baseDelayMs: 0,
  ...overrides,
})

describe('photoType / rejectReason', () => {
  it('uses the file type, or the extension when the browser gives none', () => {
    expect(photoType(photo('a.jpg', 'image/jpeg'))).toBe('image/jpeg')
    expect(photoType(photo('IMG_1.HEIC', ''))).toBe('image/heic')
    expect(photoType(photo('doc.pdf', 'application/pdf'))).toBeNull()
  })

  it('explains why a file cannot be uploaded', () => {
    expect(rejectReason(photo('doc.pdf', 'application/pdf'))).toBe('type')
    expect(rejectReason(photo('big.jpg', 'image/jpeg', 0))).toBe('empty')
    const big = photo()
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 })
    expect(rejectReason(big)).toBe('size')
    expect(rejectReason(photo())).toBeNull()
  })
})

describe('uploadPhoto', () => {
  it('starts, uploads to Drive, then confirms', async () => {
    const apiImpl = fakeApi()
    const stages = []
    const putImpl = vi.fn(async (url, file, type, { onProgress }) => {
      onProgress(0.5)
      onProgress(1)
      return { id: 'drive123' }
    })
    const onProgress = vi.fn()
    const result = await uploadPhoto(
      base({ apiImpl, putImpl, onProgress, onStage: (s) => stages.push(s) }),
    )

    expect(apiImpl.startUpload).toHaveBeenCalledWith({
      story_id: 'st_abcdef12',
      edit_token: 'e'.repeat(40),
      origin: 'https://tamar70.web.app',
      filename: 'IMG_1.JPG',
      mime: 'image/jpeg',
      bytes: 1000,
    })
    expect(putImpl.mock.calls[0][0]).toBe('https://u/1')
    expect(apiImpl.finishUpload).toHaveBeenCalledWith(
      expect.objectContaining({ media_id: 'md_1aaaaaa', drive_file_id: 'drive123' }),
    )
    expect(result).toEqual({ media_id: 'md_1aaaaaa', width: 10, height: 10 })
    expect(stages).toEqual(['starting', 'uploading', 'confirming'])
    expect(onProgress).toHaveBeenLastCalledWith(1)
  })

  it('starts over with a fresh session when the upload drops', async () => {
    const apiImpl = fakeApi()
    const putImpl = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('network', 'dropped'))
      .mockResolvedValueOnce({ id: 'drive456' })
    const result = await uploadPhoto(base({ apiImpl, putImpl }))
    expect(apiImpl.startUpload).toHaveBeenCalledTimes(2)
    expect(putImpl.mock.calls[1][0]).toBe('https://u/2')
    expect(result.media_id).toBe('md_2aaaaaa')
  })

  it('does not retry errors that will not change', async () => {
    const apiImpl = fakeApi()
    apiImpl.startUpload.mockRejectedValueOnce(new ApiError('too_many_photos', 'cap'))
    await expect(uploadPhoto(base({ apiImpl, putImpl: vi.fn() }))).rejects.toMatchObject({
      code: 'too_many_photos',
    })
    expect(apiImpl.startUpload).toHaveBeenCalledTimes(1)
  })

  it('gives up after the last attempt', async () => {
    const apiImpl = fakeApi()
    const putImpl = vi.fn().mockRejectedValue(new ApiError('network', 'dropped'))
    await expect(uploadPhoto(base({ apiImpl, putImpl, attempts: 2 }))).rejects.toMatchObject({
      code: 'network',
    })
    expect(putImpl).toHaveBeenCalledTimes(2)
  })
})
