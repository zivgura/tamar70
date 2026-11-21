// The only place the site talks to the backend. If the backend ever moves (Plan B: Cloudflare
// Workers), only this file changes.
import { ACTIONS, ERROR_CODES, RETRYABLE_ERROR_CODES } from '@tamar70/shared'

export const API_URL = import.meta.env.VITE_API_URL

export class ApiError extends Error {
  constructor(code, message, details) {
    super(message || code)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }

  get retryable() {
    return RETRYABLE_ERROR_CODES.includes(this.code) || this.code === 'network'
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function once(action, payload, { url, fetchImpl, signal }) {
  let res
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      // text/plain keeps this a "simple" request: no CORS preflight, which Apps Script can't answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload }),
      redirect: 'follow',
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError('network', 'Could not reach the server')
  }
  if (!res.ok) throw new ApiError('network', `HTTP ${res.status}`)

  let body
  try {
    body = await res.json()
  } catch {
    throw new ApiError(ERROR_CODES.INTERNAL, 'The server sent an unreadable answer')
  }
  if (body?.ok) return body.data
  const { code = ERROR_CODES.INTERNAL, message, details } = body?.error ?? {}
  throw new ApiError(code, message, details)
}

/**
 * Calls one API action. Network failures and busy/internal errors are retried with
 * exponential backoff and jitter (Apps Script shares 30 concurrent executions between all
 * visitors). Retrying a submission is safe: the server dedupes it by its edit token.
 */
export async function apiCall(action, payload = {}, options = {}) {
  const {
    url = API_URL,
    fetchImpl = (...args) => fetch(...args),
    retries = 3,
    baseDelayMs = 600,
    signal,
  } = options
  if (!url) throw new ApiError('not_configured', 'The API URL is not configured yet')

  for (let attempt = 0; ; attempt++) {
    try {
      return await once(action, payload, { url, fetchImpl, signal })
    } catch (err) {
      if (!(err instanceof ApiError) || !err.retryable || attempt >= retries) throw err
      await sleep(baseDelayMs * 2 ** attempt * (0.5 + Math.random()))
    }
  }
}

export const api = {
  site: (opts) => apiCall(ACTIONS.SITE, {}, opts),
  bootstrap: (opts) => apiCall(ACTIONS.BOOTSTRAP, {}, opts),
  categories: (opts) => apiCall(ACTIONS.CATEGORIES_LIST, {}, opts),
  stories: (opts) => apiCall(ACTIONS.STORIES_LIST, {}, opts),
  story: (id, opts) => apiCall(ACTIONS.STORIES_GET, { id }, opts),
  submitStory: (submission, opts) => apiCall(ACTIONS.STORIES_SUBMIT, submission, opts),
  startUpload: (request, opts) => apiCall(ACTIONS.MEDIA_START, request, opts),
  finishUpload: (request, opts) => apiCall(ACTIONS.MEDIA_FINISH, request, opts),
  // The contributor's own story, from the device that sent it
  gallery: () => apiCall(ACTIONS.GALLERY),
  importGoogleDoc: (url) => apiCall(ACTIONS.GOOGLE_DOC_IMPORT, { url }),
  getOwn: (request, opts) => apiCall(ACTIONS.OWN_GET, request, opts),
  updateOwn: (request, opts) => apiCall(ACTIONS.OWN_UPDATE, request, opts),
  deleteOwn: (request, opts) => apiCall(ACTIONS.OWN_DELETE, request, opts),
  updateOwnPhoto: (request, opts) => apiCall(ACTIONS.OWN_MEDIA_UPDATE, request, opts),
  removeOwnPhoto: (request, opts) => apiCall(ACTIONS.OWN_MEDIA_REMOVE, request, opts),
}

/** A private token for editing one's own story later. Kept on the device, never shown. */
export function newEditToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
