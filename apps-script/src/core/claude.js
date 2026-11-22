// Calls to the Claude API (the Messages API). The key lives only in the Script Properties
// (CLAUDE_API_KEY); ctx.ai sends the request, this file builds it and reads the answer.
import { ERROR_CODES } from '@tamar70/shared'
import { ApiError } from './errors.js'

export class ClaudeError extends Error {
  constructor(message, { retryable = false, status = 0 } = {}) {
    super(message)
    this.name = 'ClaudeError'
    this.retryable = retryable
    this.status = status
  }
}

// Plain words for what went wrong, shown to admins on the escape-room page.
function describeFailure(status, body) {
  const apiMessage = body?.error?.message ? ` (${String(body.error.message).slice(0, 200)})` : ''
  if (status === 401) return 'מפתח ה-API לא תקין. בדקו את CLAUDE_API_KEY.'
  if (status === 403) return `אין הרשאה למודל הזה${apiMessage}`
  if (status === 400 && /credit|billing/i.test(apiMessage)) return 'נגמר הקרדיט בחשבון Claude.'
  if (status === 429) return 'יותר מדי בקשות ל-Claude. נסו שוב בעוד דקה.'
  if (status === 529 || status >= 500) return 'השרת של Claude עמוס כרגע. נסו שוב מאוחר יותר.'
  return `Claude החזיר שגיאה ${status}${apiMessage}`
}

/**
 * One Messages API call. Returns { text, tokensIn, tokensOut, stopReason }.
 * Throws ApiError(AI_NOT_CONFIGURED) without a key, ClaudeError when Claude says no.
 */
export function askClaude(ctx, { model, system, prompt, maxTokens = 1024 }) {
  if (!ctx.ai.configured()) {
    throw new ApiError(ERROR_CODES.AI_NOT_CONFIGURED, 'No Claude API key in the Script Properties')
  }
  const request = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  }
  if (system) request.system = system

  let response
  try {
    response = ctx.ai.post(request)
  } catch (err) {
    throw new ClaudeError(`לא הצלחנו להגיע ל-Claude: ${err && err.message}`, { retryable: true })
  }

  let body = null
  try {
    body = JSON.parse(response.body)
  } catch {
    body = null
  }
  if (response.status !== 200) {
    throw new ClaudeError(describeFailure(response.status, body), {
      status: response.status,
      retryable: response.status === 429 || response.status >= 500,
    })
  }

  const text = (body?.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
  return {
    text,
    tokensIn: Number(body?.usage?.input_tokens ?? 0),
    tokensOut: Number(body?.usage?.output_tokens ?? 0),
    stopReason: body?.stop_reason ?? null,
  }
}
