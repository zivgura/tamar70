// Uploads one photo: the API opens a Drive session, the browser sends the original file
// straight to Drive (with progress), then the API confirms it. A failed attempt starts over
// with a fresh session, so a flaky connection doesn't lose the photo or the story.
import { DOCX_TYPE, MAX_PHOTO_BYTES, PHOTO_TYPES } from '@tamar70/shared'
import { api, ApiError } from '../api/client.js'

const EXTENSION_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
}

/** The file's photo type, or null if it isn't a photo we accept. */
export function photoType(file) {
  if (PHOTO_TYPES.includes(file.type)) return file.type
  const ext = String(file.name).split('.').pop().toLowerCase()
  return EXTENSION_TYPES[ext] ?? null
}

/** The upload type of any file we keep: a photo, or a Word document. */
export function uploadType(file) {
  const photo = photoType(file)
  if (photo) return photo
  if (file.type === DOCX_TYPE || /\.docx$/i.test(String(file.name))) return DOCX_TYPE
  return null
}

/** Why a file can't be uploaded, or null if it can. */
export function rejectReason(file) {
  if (!photoType(file)) return 'type'
  if (file.size > MAX_PHOTO_BYTES) return 'size'
  if (file.size === 0) return 'empty'
  return null
}

// Files go up in pieces of 8 MB (Drive wants multiples of 256 KB). After a dropped
// connection the upload asks Drive how much arrived and goes on from there, instead of
// starting the photo over.
export const CHUNK_BYTES = 8 * 1024 * 1024
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const RESUME_TRIES = 4

/** One PUT to the session. Resolves with { status, range, body }; rejects on a network error. */
function send(url, body, headers, { onProgress, signal, XHR }) {
  return new Promise((resolve, reject) => {
    const xhr = new XHR()
    xhr.open('PUT', url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded)
    }
    xhr.onload = () =>
      resolve({
        status: xhr.status,
        range: xhr.getResponseHeader?.('Range') ?? null,
        body: xhr.responseText,
      })
    xhr.onerror = () => reject(new ApiError('network', 'The upload was interrupted'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

/** "bytes=0-1048575" → 1048576, the next byte Drive wants. */
const nextByte = (range) => {
  const m = /bytes=0-(\d+)/.exec(range ?? '')
  return m ? Number(m[1]) + 1 : null
}

function finished(response) {
  try {
    return JSON.parse(response.body)
  } catch {
    throw new ApiError('upload_failed', 'Drive sent an unreadable answer')
  }
}

/**
 * Sends the file to a Drive resumable-session URL, in chunks, resuming after interruptions.
 * Progress goes from 0 to 1. Resolves with Drive's file resource ({ id }).
 */
export async function putToDrive(
  url,
  file,
  type,
  { onProgress, signal, XHR = XMLHttpRequest, chunkBytes = CHUNK_BYTES, waitMs = 1000 } = {},
) {
  const size = file.size
  let offset = 0
  let tries = 0
  while (true) {
    const end = Math.min(offset + chunkBytes, size)
    let response
    let asked = false // true when the response answers "how much arrived?"
    try {
      response = await send(
        url,
        file.slice(offset, end),
        // The whole file in one go is a plain PUT, exactly as before chunking.
        offset === 0 && end === size
          ? { 'Content-Type': type }
          : { 'Content-Type': type, 'Content-Range': `bytes ${offset}-${end - 1}/${size}` },
        { onProgress: (loaded) => onProgress?.((offset + loaded) / size), signal, XHR },
      )
    } catch (err) {
      if (err?.name === 'AbortError' || ++tries > RESUME_TRIES) throw err
      await sleep(waitMs * tries)
      response = await askProgress(url, size, { signal, XHR }).catch(() => null)
      if (!response) continue // still offline: try the same piece again
      asked = true
    }

    if (response.status === 200 || response.status === 201) {
      onProgress?.(1)
      return finished(response)
    }
    if (response.status === 308) {
      // Drive says how far it got. No Range after a piece: the whole piece arrived. No Range
      // after asking: nothing arrived yet.
      offset = nextByte(response.range) ?? (asked ? 0 : end)
      if (offset > size) offset = size
      continue
    }
    if (response.status >= 500 && ++tries <= RESUME_TRIES) {
      await sleep(waitMs * tries)
      continue
    }
    // 404 / 410: the session is gone. The caller starts over with a new one.
    throw new ApiError('network', `Drive answered ${response.status}`)
  }
}

/** Asks Drive how much of the file it has (an empty PUT with "bytes *\/size"). */
function askProgress(url, size, { signal, XHR }) {
  return send(url, null, { 'Content-Range': `bytes */${size}` }, { signal, XHR })
}

/**
 * Uploads one photo to a story the device owns (proven by its edit token).
 * Progress goes from 0 to 1 while the bytes travel; `onStage` reports
 * 'starting' | 'uploading' | 'confirming' | 'retrying'.
 */
export async function uploadPhoto({
  file,
  storyId,
  editToken,
  details = {},
  onProgress,
  onStage,
  signal,
  attempts = 3,
  baseDelayMs = 1500,
  apiImpl = api,
  putImpl = putToDrive,
  origin = window.location.origin,
}) {
  const type = uploadType(file)
  if (!type) throw new ApiError('validation', 'Not a supported photo type')

  for (let attempt = 1; ; attempt++) {
    try {
      onStage?.('starting')
      const { media_id, upload_url } = await apiImpl.startUpload({
        story_id: storyId,
        edit_token: editToken,
        origin,
        filename: file.name,
        mime: type,
        bytes: file.size,
        ...details,
      })
      onStage?.('uploading')
      onProgress?.(0)
      const driveFile = await putImpl(upload_url, file, type, { onProgress, signal })
      onStage?.('confirming')
      return await apiImpl.finishUpload({
        story_id: storyId,
        edit_token: editToken,
        media_id,
        drive_file_id: driveFile.id,
      })
    } catch (err) {
      const retryable = err instanceof ApiError && err.retryable
      if (!retryable || attempt >= attempts || signal?.aborted) throw err
      onStage?.('retrying')
      await sleep(baseDelayMs * attempt)
    }
  }
}
