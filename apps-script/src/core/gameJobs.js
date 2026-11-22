// The escape room's background jobs. A Claude request can take a minute or more, longer than
// an admin's page should wait, so an admin action only queues a job and starts a one-time
// trigger; runGameJobs() (main.js) does the work and the page polls the GameJobs row.
import {
  DEFAULT_GAME_MODEL,
  ERROR_CODES,
  GAME_CONFIG_KEYS,
  GAME_MODELS,
  JOB_KIND,
  JOB_STALE_MS,
  JOB_STATUS,
  tokenCost,
} from '@tamar70/shared'
import { askClaude, ClaudeError } from './claude.js'
import { ApiError } from './errors.js'

// Stop picking up new jobs once a run has used this much of Apps Script's 6 minutes.
const RUN_BUDGET_MS = 4 * 60 * 1000
const RECENT_JOBS = 10

const ms = (iso) => Date.parse(iso) || 0

/** GameConfig tab → { key: value }. */
export function readGameConfig(db) {
  const out = {}
  for (const { key, value } of db.all('GameConfig')) if (key) out[key] = value ?? ''
  return out
}

export function writeGameConfig(db, key, value) {
  if (!db.update('GameConfig', 'key', key, { value })) db.insert('GameConfig', { key, value })
}

export function gameModel(db) {
  const chosen = readGameConfig(db)[GAME_CONFIG_KEYS.MODEL]
  return GAME_MODELS.some((m) => m.id === chosen) ? chosen : DEFAULT_GAME_MODEL
}

export function jobView(job) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    progress: job.progress ?? null,
    tokens_in: job.tokens_in ?? 0,
    tokens_out: job.tokens_out ?? 0,
    cost_usd: job.cost_usd ?? 0,
    error: job.error || null,
    admin_email: job.admin_email,
    created_at: job.created_at,
    started_at: job.started_at || null,
    finished_at: job.finished_at || null,
  }
}

export function recentJobs(ctx) {
  return ctx.db
    .all('GameJobs')
    .filter((j) => j.id)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, RECENT_JOBS)
    .map(jobView)
}

/** Jobs left queued or running past JOB_STALE_MS died with their execution: mark them failed. */
export function expireStaleJobs(ctx) {
  const now = ms(ctx.now())
  for (const job of ctx.db.all('GameJobs')) {
    const since = job.status === JOB_STATUS.RUNNING ? job.started_at : job.created_at
    const open = job.status === JOB_STATUS.RUNNING || job.status === JOB_STATUS.QUEUED
    if (open && now - ms(since) > JOB_STALE_MS) {
      ctx.db.update('GameJobs', 'id', job.id, {
        status: JOB_STATUS.FAILED,
        error: 'העבודה נעצרה באמצע (עבר יותר מדי זמן). נסו שוב.',
        finished_at: ctx.now(),
      })
    }
  }
}

const isOpen = (job) => job.status === JOB_STATUS.QUEUED || job.status === JOB_STATUS.RUNNING

/** Queues a job and starts the trigger that runs it. One job at a time. */
export function queueJob(ctx, admin, kind, params = {}) {
  if (!ctx.ai.configured()) {
    throw new ApiError(ERROR_CODES.AI_NOT_CONFIGURED, 'No Claude API key in the Script Properties')
  }
  const job = ctx.lock.run(() => {
    expireStaleJobs(ctx)
    if (ctx.db.all('GameJobs').some(isOpen)) {
      throw new ApiError(ERROR_CODES.JOB_RUNNING, 'Another job is still running')
    }
    const row = {
      id: `gj_${ctx.crypto.randomId(12)}`,
      kind,
      status: JOB_STATUS.QUEUED,
      params,
      progress: null,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      error: '',
      admin_email: admin.email,
      created_at: ctx.now(),
      started_at: '',
      finished_at: '',
    }
    ctx.db.insert('GameJobs', row)
    ctx.db.insert('AuditLog', {
      ts: ctx.now(),
      admin_email: admin.email,
      action: 'game.job',
      target_id: row.id,
      details: { kind },
    })
    return row
  })

  try {
    ctx.jobs.start()
  } catch (err) {
    ctx.log.error(`Could not start the game job trigger: ${err && err.message}`)
    const failed = { status: JOB_STATUS.FAILED, error: 'לא הצלחנו להפעיל את העבודה ברקע.' }
    ctx.lock.run(() => ctx.db.update('GameJobs', 'id', job.id, failed))
    return jobView({ ...job, ...failed })
  }
  return jobView(job)
}

// What each kind of job does. Each gets the job and a `usage(tokensIn, tokensOut)` to count
// tokens, and returns the job's progress (shown on the page).
const RUNNERS = {
  [JOB_KIND.CHECK](ctx, job, usage) {
    const answer = askClaude(ctx, {
      model: gameModel(ctx.db),
      prompt: 'זו בדיקת חיבור. ענו במילה אחת בעברית: שלום.',
      maxTokens: 20,
    })
    usage(answer.tokensIn, answer.tokensOut)
    return { reply: answer.text.trim().slice(0, 200), model: gameModel(ctx.db) }
  },
}

function failureText(err) {
  if (err instanceof ClaudeError) return err.message
  if (err instanceof ApiError && err.code === ERROR_CODES.AI_NOT_CONFIGURED) {
    return 'אין מפתח Claude API בהגדרות הסקריפט.'
  }
  return 'משהו השתבש בעבודה. נסו שוב.'
}

function runOne(ctx, job) {
  const model = gameModel(ctx.db)
  let tokensIn = 0
  let tokensOut = 0
  const usage = (i, o) => {
    tokensIn += i
    tokensOut += o
  }
  const totals = () => ({
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: tokenCost(model, tokensIn, tokensOut),
    finished_at: ctx.now(),
  })

  try {
    const progress = RUNNERS[job.kind](ctx, job, usage)
    ctx.lock.run(() =>
      ctx.db.update('GameJobs', 'id', job.id, {
        status: JOB_STATUS.DONE,
        progress,
        error: '',
        ...totals(),
      }),
    )
  } catch (err) {
    if (!(err instanceof ClaudeError)) {
      ctx.log.error(`Game job ${job.id} failed: ${err && err.stack ? err.stack : err}`)
    }
    ctx.lock.run(() =>
      ctx.db.update('GameJobs', 'id', job.id, {
        status: JOB_STATUS.FAILED,
        error: failureText(err),
        ...totals(),
      }),
    )
  }
}

/** Runs queued jobs, oldest first, until none are left or the time budget is spent. */
export function runQueuedJobs(ctx) {
  try {
    ctx.jobs.clear()
  } catch (err) {
    ctx.log.error(`Could not remove old game job triggers: ${err && err.message}`)
  }
  const started = Date.now()
  let ran = 0
  while (Date.now() - started < RUN_BUDGET_MS) {
    const job = ctx.lock.run(() => {
      expireStaleJobs(ctx)
      const next = ctx.db
        .all('GameJobs')
        .filter((j) => j.status === JOB_STATUS.QUEUED && RUNNERS[j.kind])
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0]
      if (!next) return null
      const patch = { status: JOB_STATUS.RUNNING, started_at: ctx.now() }
      ctx.db.update('GameJobs', 'id', next.id, patch)
      return { ...next, ...patch }
    })
    if (!job) break
    runOne(ctx, job)
    ran++
  }
  return ran
}
