// The API contract between web/ and apps-script/.
//
// Every call is a POST with Content-Type: text/plain (avoids the CORS preflight Apps Script
// can't answer). Body: { action, payload }. Response: { ok: true, data } or
// { ok: false, error: { code, message } }. Apps Script always answers HTTP 200, so callers
// must look at `ok`, not the status code.

export const ACTIONS = Object.freeze({
  SITE: 'site.get',
  CATEGORIES_LIST: 'categories.list',
  STORIES_LIST: 'stories.list',
  STORIES_GET: 'stories.get',
  STORIES_SUBMIT: 'stories.submit',
})

export const ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'bad_request',
  UNKNOWN_ACTION: 'unknown_action',
  VALIDATION: 'validation',
  BAD_FAMILY_CODE: 'bad_family_code',
  SUBMISSIONS_CLOSED: 'submissions_closed',
  NOT_FOUND: 'not_found',
  BUSY: 'busy',
  INTERNAL: 'internal',
})

// Errors worth retrying with backoff: the server was busy or failed unexpectedly.
export const RETRYABLE_ERROR_CODES = Object.freeze([ERROR_CODES.BUSY, ERROR_CODES.INTERNAL])
