// The Sheet's tabs and columns, from the spec's data model. Each tab's first row holds the
// column names. Bump SCHEMA_VERSION whenever a tab or column is added: the server notices on its
// next request and adds what's missing (it never deletes or reorders anything).

export const SCHEMA_VERSION = 7

// Column types, used to convert between Sheet cells (always stored as text) and JS values.
export const T = Object.freeze({
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json',
})

const col = (name, type = T.STRING) => ({ name, type })

export const TABLES = Object.freeze({
  Stories: [
    col('id'),
    col('kind'),
    col('title'),
    col('content'),
    col('excerpt'),
    col('author_name'),
    col('author_relation'),
    col('category_id'),
    col('decade', T.NUMBER),
    col('year_approx', T.NUMBER),
    col('places', T.JSON),
    col('people', T.JSON),
    col('tags', T.JSON),
    col('status'),
    col('visibility'),
    col('featured', T.BOOLEAN),
    col('media_count', T.NUMBER),
    col('created_at'),
    col('updated_at'),
    col('admin_notes'),
    col('edit_token_hash'),
  ],
  Media: [
    col('id'),
    col('story_id'),
    col('drive_file_id'),
    col('filename'),
    col('mime'),
    col('bytes', T.NUMBER),
    col('width', T.NUMBER),
    col('height', T.NUMBER),
    col('caption'),
    col('year_approx', T.NUMBER),
    col('people', T.JSON),
    col('place'),
    col('sort_order', T.NUMBER),
    col('upload_status'),
    col('is_shared', T.BOOLEAN),
    col('uploaded_at'),
  ],
  Comments: [
    col('id'),
    col('story_id'),
    col('author_name'),
    col('content'),
    col('created_at'),
    col('status'),
  ],
  Categories: [
    col('id'),
    col('name'),
    col('description'),
    col('prompt_hint'),
    col('color'),
    col('order', T.NUMBER),
    col('active', T.BOOLEAN),
  ],
  Settings: [col('key'), col('value')],
  AdminUsers: [col('email'), col('name'), col('added_at')],
  AuditLog: [
    col('ts'),
    col('admin_email'),
    col('action'),
    col('target_id'),
    col('details', T.JSON),
  ],
  Entities: [
    col('id'),
    col('type'),
    col('name'),
    col('aliases', T.JSON),
    col('story_ids', T.JSON),
    col('media_ids', T.JSON),
  ],
  GameFacts: [
    col('id'),
    col('statement'),
    col('type'),
    col('source_story_id'),
    col('source_media_id'),
    col('source_quote'),
    col('verified', T.BOOLEAN),
  ],
  GamePuzzles: [
    col('id'),
    col('type'),
    col('question'),
    col('answer'),
    col('answer_format'),
    col('hints', T.JSON),
    col('difficulty', T.NUMBER),
    col('fact_ids', T.JSON),
    col('source_story_ids', T.JSON),
    col('source_media_ids', T.JSON),
    col('code_fragment'),
    col('order', T.NUMBER),
    col('status'),
    col('print_notes'),
  ],
  GameConfig: [col('key'), col('value')],
  // What the site reports about itself (see shared/src/telemetry.js).
  ClientErrors: [
    col('id'),
    col('ts'),
    col('message'),
    col('path'),
    col('stack'),
    col('release'),
    col('user_agent'),
    col('device'),
    col('count', T.NUMBER),
    col('last_seen'),
  ],
  Visits: [
    col('date'),
    col('device'),
    col('path'),
    col('has_code', T.BOOLEAN),
    col('first_visit', T.BOOLEAN),
  ],
})

export const SETTING_KEYS = Object.freeze({
  SITE_STATUS: 'site_status',
  BIRTHDAY_DATE: 'birthday_date',
  SUBMISSIONS_OPEN: 'submissions_open',
  COMMENTS_OPEN: 'comments_open',
  REVEAL_MESSAGE: 'reveal_message',
  NOTIFY_EMAILS: 'notify_emails',
  // Bookkeeping for the scheduled housekeeping job (see apps-script/src/core/housekeeping.js).
  NOTIFIED_UNTIL: 'notified_until',
  CLEANED_AT: 'cleaned_at',
  // How admins hear about new stories: see NOTIFY_MODE. Changed from the admin settings page.
  NOTIFY_MODE: 'notify_mode',
  DIGEST_SENT_ON: 'digest_sent_on',
  HOUSEKEEPING_RAN_AT: 'housekeeping_ran_at',
  BACKED_UP_AT: 'backed_up_at',
})

export const NOTIFY_MODE = Object.freeze({
  EACH: 'each', // one email per story
  DAILY: 'daily', // one summary a day, in the evening
  OFF: 'off',
})
// The daily summary goes out on the first run after this hour, Israel time.
export const DIGEST_HOUR = 20
