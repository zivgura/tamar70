import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.js'
import { photoType, putToDrive, rejectReason, uploadPhoto } from './uploadPhoto.js'

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

describe('putToDrive', () => {
  /** A fake XMLHttpRequest whose answers come from `script`, one per request. */
  function fakeXhr(script) {
    const requests = []
    class XHR {
      constructor() {
        this.headers = {}
        this.upload = {}
      }
      open(method, url) {
        this.method = method
        this.url = url
      }
      setRequestHeader(name, value) {
        this.headers[name] = value
      }
      getResponseHeader(name) {
        return name === 'Range' ? (this.answer.range ?? null) : null
      }
      send(body) {
        const answer = script.shift()
        requests.push({ headers: this.headers, size: body ? body.size : 0 })
        this.answer = answer
        queueMicrotask(() => {
          if (answer === 'drop') return this.onerror()
          if (body) this.upload.onprogress?.({ lengthComputable: true, loaded: body.size })
          this.status = answer.status
          this.responseText = answer.body ?? ''
          this.onload()
        })
      }
    }
    return { XHR, requests }
  }
  const file = new Blob(['0123456789']) // 10 bytes
  const opts = (XHR, extra = {}) => ({ XHR, chunkBytes: 4, waitMs: 0, ...extra })

  it('sends the file in pieces and returns the Drive file', async () => {
    const { XHR, requests } = fakeXhr([
      { status: 308, range: 'bytes=0-3' },
      { status: 308, range: 'bytes=0-7' },
      { status: 200, body: '{"id":"drive1"}' },
    ])
    const progress = []
    const result = await putToDrive('https://up/1', file, 'image/jpeg', {
      ...opts(XHR),
      onProgress: (p) => progress.push(p),
    })
    expect(result).toEqual({ id: 'drive1' })
    expect(requests.map((r) => r.headers['Content-Range'])).toEqual([
      'bytes 0-3/10',
      'bytes 4-7/10',
      'bytes 8-9/10',
    ])
    expect(progress.at(-1)).toBe(1)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
  })

  it('after a dropped connection, asks Drive how much arrived and goes on from there', async () => {
    const { XHR, requests } = fakeXhr([
      { status: 308, range: 'bytes=0-3' },
      'drop',
      { status: 308, range: 'bytes=0-5' }, // the answer to "how much arrived?"
      { status: 201, body: '{"id":"drive2"}' },
    ])
    const result = await putToDrive('https://up/2', file, 'image/jpeg', opts(XHR))
    expect(result).toEqual({ id: 'drive2' })
    expect(requests.map((r) => r.headers['Content-Range'])).toEqual([
      'bytes 0-3/10',
      'bytes 4-7/10',
      'bytes */10',
      'bytes 6-9/10',
    ])
  })

  it('goes on with the next piece when Drive hides how far it got', async () => {
    const { XHR, requests } = fakeXhr([
      { status: 308 },
      { status: 308 },
      { status: 200, body: '{"id":"drive3"}' },
    ])
    await putToDrive('https://up/3', file, 'image/jpeg', opts(XHR))
    expect(requests.map((r) => r.headers['Content-Range'])).toEqual([
      'bytes 0-3/10',
      'bytes 4-7/10',
      'bytes 8-9/10',
    ])
  })

  it('sends a small file in one plain request', async () => {
    const { XHR, requests } = fakeXhr([{ status: 200, body: '{"id":"drive6"}' }])
    await putToDrive('https://up/6', file, 'image/jpeg', opts(XHR, { chunkBytes: 1024 }))
    expect(requests).toEqual([{ headers: { 'Content-Type': 'image/jpeg' }, size: 10 }])
  })

  it('gives up on a session Drive no longer knows, so a new one is opened', async () => {
    const { XHR } = fakeXhr([{ status: 404 }])
    await expect(putToDrive('https://up/4', file, 'image/jpeg', opts(XHR))).rejects.toMatchObject({
      code: 'network',
    })
  })

  it('stops after a few failed tries', async () => {
    const { XHR } = fakeXhr(Array(20).fill('drop'))
    await expect(putToDrive('https://up/5', file, 'image/jpeg', opts(XHR))).rejects.toMatchObject({
      code: 'network',
    })
  })
})
