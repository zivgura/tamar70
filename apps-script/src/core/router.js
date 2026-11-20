import { apiRequestSchema, ERROR_CODES } from '@tamar70/shared'
import { ZodError } from 'zod'
import { handlers } from './actions.js'
import { ApiError } from './errors.js'
import { migrate } from './migrate.js'

const fail = (code, message, details) => ({
  ok: false,
  error: details ? { code, message, details } : { code, message },
})

function describeIssues(err) {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
}

/** Raw POST body → response envelope. Never throws. */
export function handleRequest(body, ctx) {
  let request
  try {
    request = apiRequestSchema.parse(JSON.parse(body || ''))
  } catch {
    return fail(ERROR_CODES.BAD_REQUEST, 'Expected a JSON body: { action, payload }')
  }

  const handler = Object.prototype.hasOwnProperty.call(handlers, request.action)
    ? handlers[request.action]
    : null
  if (!handler) return fail(ERROR_CODES.UNKNOWN_ACTION, `Unknown action: ${request.action}`)

  try {
    migrate(ctx)
    return { ok: true, data: handler(ctx, request.payload) }
  } catch (err) {
    if (err instanceof ApiError) return fail(err.code, err.message)
    if (err instanceof ZodError) {
      return fail(ERROR_CODES.VALIDATION, 'Invalid input', describeIssues(err))
    }
    ctx.log.error(`${request.action} failed: ${err && err.stack ? err.stack : err}`)
    return fail(ERROR_CODES.INTERNAL, 'Something went wrong')
  }
}
