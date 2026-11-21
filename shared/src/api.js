// The API contract between web/ and apps-script/.
//
// Every call is a POST with Content-Type: text/plain (avoids the CORS preflight Apps Script
// can't answer). Body: { action, payload }. Response: { ok: true, data } or
// { ok: false, error: { code, message } }. Apps Script always answers HTTP 200, so callers
// must look at `ok`, not the status code.

export const ACTIONS = Object.freeze({
  SITE: 'site.get',
  BOOTSTRAP: 'site.bootstrap',
  CATEGORIES_LIST: 'categories.list',
  STORIES_LIST: 'stories.list',
  STORIES_GET: 'stories.get',
  STORIES_SUBMIT: 'stories.submit',
  MEDIA_START: 'media.start',
  MEDIA_FINISH: 'media.finish',
  OWN_GET: 'stories.getOwn',
  OWN_UPDATE: 'stories.update',
  OWN_DELETE: 'stories.delete',
  OWN_MEDIA_UPDATE: 'media.update',
  OWN_MEDIA_REMOVE: 'media.remove',
  // Is the family code on this device still good? (Checked before someone writes a story.)
  FAMILY_CHECK: 'family.check',
  // The site reporting about itself (sent with sendBeacon, nobody waits for the answer):
  CLIENT_ERROR: 'client.error',
  CLIENT_VISIT: 'client.visit',
  // Admins only (Google sign-in):
  ADMIN_ME: 'admin.me',
  ADMIN_STORIES: 'admin.stories',
  ADMIN_STORY: 'admin.story',
  ADMIN_STORY_UPDATE: 'admin.storyUpdate',
  ADMIN_VISIBILITY: 'admin.setVisibility',
  ADMIN_STORY_DELETE: 'admin.storyDelete',
  ADMIN_MEDIA_REMOVE: 'admin.mediaRemove',
  ADMIN_STATS: 'admin.stats',
})

export const ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'bad_request',
  UNKNOWN_ACTION: 'unknown_action',
  VALIDATION: 'validation',
  BAD_FAMILY_CODE: 'bad_family_code',
  SUBMISSIONS_CLOSED: 'submissions_closed',
  NOT_FOUND: 'not_found',
  FORBIDDEN: 'forbidden',
  EDITING_CLOSED: 'editing_closed',
  SIGN_IN_REQUIRED: 'sign_in_required', // no Google sign-in, or it expired
  NOT_ADMIN: 'not_admin', // signed in, but not in AdminUsers
  TOO_MANY_PHOTOS: 'too_many_photos',
  UPLOAD_FAILED: 'upload_failed',
  BUSY: 'busy',
  INTERNAL: 'internal',
})

// Errors worth retrying with backoff: the server was busy or failed unexpectedly.
export const RETRYABLE_ERROR_CODES = Object.freeze([ERROR_CODES.BUSY, ERROR_CODES.INTERNAL])
