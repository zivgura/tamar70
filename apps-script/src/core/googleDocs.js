// "Already wrote it in Google Docs?": the add page sends the doc's link, and this answers
// with its text. Only docs shared "anyone with the link" can be read (the fetch carries no
// credentials), and the call is public, so it's capped per hour.
import { ERROR_CODES, googleDocId, LIMITS, tidyDocText } from '@tamar70/shared'
import { ApiError } from './errors.js'
import { underHourlyLimit } from './telemetry.js'

export const DOC_IMPORTS_PER_HOUR = 60

export function importGoogleDoc(ctx, payload) {
  const docId = googleDocId(payload?.url)
  if (!docId) throw new ApiError(ERROR_CODES.DOC_BAD_LINK, 'Not a Google Docs document link')
  if (!underHourlyLimit(ctx, 'doc-imports', DOC_IMPORTS_PER_HOUR)) {
    throw new ApiError(ERROR_CODES.BUSY, 'Too many documents this hour, try again later')
  }
  let raw
  try {
    raw = ctx.google.docText(docId)
  } catch (err) {
    ctx.log.error(`Google Doc fetch failed: ${err && err.message}`)
    throw new ApiError(ERROR_CODES.BUSY, 'Could not reach Google Docs, try again')
  }
  if (raw === null) throw new ApiError(ERROR_CODES.DOC_NOT_SHARED, 'The document is not shared')
  const text = tidyDocText(raw)
  // The site checks the length against what's already typed; this only guards the answer size.
  return { text: text.slice(0, LIMITS.STORY_CONTENT_MAX + 1) }
}
