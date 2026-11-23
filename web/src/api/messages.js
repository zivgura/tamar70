// What to tell people when something fails, by API error code. Plain, kind words; the texts
// live in the i18n dictionaries (error.<code>). Admin pages use the Hebrew default.
import { translate } from '../i18n/i18n.js'

const KNOWN = new Set([
  'submissions_closed',
  'too_many_photos',
  'validation',
  'forbidden',
  'doc_not_shared',
  'doc_bad_link',
  'editing_closed',
  'sign_in_required',
  'not_admin',
  'not_found',
  'upload_failed',
  'network',
  'busy',
  'ai_not_configured',
  'job_running',
  'not_configured',
])

export function errorMessage(err, lang = 'he') {
  const code = err?.code
  return translate(lang, KNOWN.has(code) ? `error.${code}` : 'error.generic')
}

/** Why a picked file can't be uploaded, by reason (type, size, empty). */
export function rejectMessage(reason, lang = 'he') {
  return translate(lang, `reject.${reason}`)
}

/** The Hebrew texts by reason, for the hidden upload test page. */
export const REJECT_MESSAGES = {
  type: translate('he', 'reject.type'),
  size: translate('he', 'reject.size'),
  empty: translate('he', 'reject.empty'),
}
