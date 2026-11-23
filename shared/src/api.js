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
  // The same for all of a story's files in one call each (faster: each call costs seconds).
  MEDIA_START_MANY: 'media.startMany',
  MEDIA_FINISH_MANY: 'media.finishMany',
  OWN_GET: 'stories.getOwn',
  OWN_UPDATE: 'stories.update',
  OWN_DELETE: 'stories.delete',
  OWN_MEDIA_UPDATE: 'media.update',
  OWN_MEDIA_REMOVE: 'media.remove',
  // Every shared photo of the visible stories, for the gallery (after the reveal).
  GALLERY: 'gallery.list',
  // A Google Docs link pasted instead of typing: returns the doc's text.
  GOOGLE_DOC_IMPORT: 'docs.import',
  // The site reporting about itself (sent with sendBeacon, nobody waits for the answer):
  CLIENT_ERROR: 'client.error',
  CLIENT_VISIT: 'client.visit',
  // Admins only (Google sign-in):
  ADMIN_ME: 'admin.me',
  ADMIN_STORIES: 'admin.stories',
  ADMIN_STORY: 'admin.story',
  // A story's photo thumbnails, loaded after the story itself (they take the longest).
  ADMIN_STORY_THUMBS: 'admin.storyThumbs',
  ADMIN_STORY_UPDATE: 'admin.storyUpdate',
  ADMIN_VISIBILITY: 'admin.setVisibility',
  ADMIN_STORY_DELETE: 'admin.storyDelete',
  ADMIN_MEDIA_REMOVE: 'admin.mediaRemove',
  ADMIN_STATS: 'admin.stats',
  ADMIN_SETTINGS: 'admin.settings',
  ADMIN_SETTINGS_UPDATE: 'admin.settingsUpdate',
  ADMIN_TEST_EMAIL: 'admin.testEmail',
  ADMIN_SITE_STATUS: 'admin.setSiteStatus',
  ADMIN_BACKUP: 'admin.backup',
  ADMIN_EXPORT: 'admin.export',
  // The escape room (admins only): its status, the AI model, and background jobs.
  ADMIN_GAME: 'admin.game',
  ADMIN_GAME_CONFIG: 'admin.gameConfig',
  ADMIN_GAME_JOB_START: 'admin.gameJobStart',
})

export const ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'bad_request',
  UNKNOWN_ACTION: 'unknown_action',
  VALIDATION: 'validation',
  SUBMISSIONS_CLOSED: 'submissions_closed',
  NOT_FOUND: 'not_found',
  FORBIDDEN: 'forbidden',
  EDITING_CLOSED: 'editing_closed',
  DOC_NOT_SHARED: 'doc_not_shared', // the Google Doc isn't shared "anyone with the link"
  DOC_BAD_LINK: 'doc_bad_link', // not a Google Docs document link
  SIGN_IN_REQUIRED: 'sign_in_required', // no Google sign-in, or it expired
  NOT_ADMIN: 'not_admin', // signed in, but not in AdminUsers
  TOO_MANY_PHOTOS: 'too_many_photos',
  UPLOAD_FAILED: 'upload_failed',
  AI_NOT_CONFIGURED: 'ai_not_configured', // no Claude API key in the Script Properties
  JOB_RUNNING: 'job_running', // the escape room already has a job queued or running
  BUSY: 'busy',
  INTERNAL: 'internal',
})

// Errors worth retrying with backoff: the server was busy or failed unexpectedly.
export const RETRYABLE_ERROR_CODES = Object.freeze([ERROR_CODES.BUSY, ERROR_CODES.INTERNAL])
