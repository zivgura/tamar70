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

/** PUTs the file to a Drive session URL. Resolves with Drive's file resource ({ id }). */
export function putToDrive(url, file, type, { onProgress, signal, XHR = XMLHttpRequest } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XHR()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new ApiError('upload_failed', 'Drive sent an unreadable answer'))
        }
      } else {
        reject(new ApiError('network', `Drive answered ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new ApiError('network', 'The upload was interrupted'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
