// The escape room ("Tamar's Secret Room"): shared names for its background jobs and the
// Claude models it can use. No zod here, so the admin page can import it cheaply.

// What a background job does. More kinds arrive with the facts and puzzles steps.
export const JOB_KIND = Object.freeze({
  CHECK: 'check', // a tiny request that proves the API key works
})

export const JOB_STATUS = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
})

// A job still "running" after this long died with its execution (Apps Script stops at 6 min).
export const JOB_STALE_MS = 8 * 60 * 1000

// Prices in USD per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing
// (checked 2026-11-22). Used to show what each job cost.
export const GAME_MODELS = Object.freeze([
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', input: 4, output: 20 },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', input: 2, output: 10 },
])
export const DEFAULT_GAME_MODEL = GAME_MODELS[0].id

export const GAME_CONFIG_KEYS = Object.freeze({
  MODEL: 'model',
})

/** What a request cost, in USD, rounded to a hundredth of a cent. */
export function tokenCost(modelId, tokensIn, tokensOut) {
  const model = GAME_MODELS.find((m) => m.id === modelId) ?? GAME_MODELS[0]
  const usd = (tokensIn * model.input + tokensOut * model.output) / 1_000_000
  return Math.round(usd * 10_000) / 10_000
}
