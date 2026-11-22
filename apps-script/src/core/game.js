// Admin actions for the escape room ("חדר בריחה" tab).
import {
  ACTIONS,
  adminAuthSchema,
  adminGameConfigSchema,
  adminGameJobSchema,
  GAME_CONFIG_KEYS,
  GAME_MODELS,
  JOB_STATUS,
} from '@tamar70/shared'
import { requireAdmin } from './admin.js'
import { expireStaleJobs, gameModel, queueJob, recentJobs, writeGameConfig } from './gameJobs.js'

// A job queued this long ago that hasn't started probably lost its trigger: start another.
const RESTART_AFTER_MS = 2 * 60 * 1000

function counts(ctx) {
  const facts = ctx.db.all('GameFacts').filter((f) => f.id)
  const puzzles = ctx.db.all('GamePuzzles').filter((p) => p.id)
  return {
    facts: facts.length,
    facts_kept: facts.filter((f) => f.status === 'kept').length,
    puzzles: puzzles.length,
    puzzles_approved: puzzles.filter((p) => p.status === 'approved').length,
  }
}

function nudgeQueuedJob(ctx) {
  const now = Date.parse(ctx.now())
  const waiting = ctx.db
    .all('GameJobs')
    .some(
      (j) => j.status === JOB_STATUS.QUEUED && now - Date.parse(j.created_at) > RESTART_AFTER_MS,
    )
  if (!waiting) return
  try {
    ctx.jobs.start()
  } catch (err) {
    ctx.log.error(`Could not restart the game job trigger: ${err && err.message}`)
  }
}

function statusView(ctx) {
  ctx.lock.run(() => expireStaleJobs(ctx))
  nudgeQueuedJob(ctx)
  return {
    ai_configured: ctx.ai.configured(),
    model: gameModel(ctx.db),
    models: GAME_MODELS.map(({ id, label, input, output }) => ({ id, label, input, output })),
    counts: counts(ctx),
    jobs: recentJobs(ctx),
  }
}

function gameStatus(ctx, payload) {
  const { id_token } = adminAuthSchema.parse(payload)
  requireAdmin(ctx, id_token)
  return statusView(ctx)
}

function setGameConfig(ctx, payload) {
  const { id_token, model } = adminGameConfigSchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  ctx.lock.run(() => {
    writeGameConfig(ctx.db, GAME_CONFIG_KEYS.MODEL, model)
    ctx.db.insert('AuditLog', {
      ts: ctx.now(),
      admin_email: admin.email,
      action: 'game.model',
      target_id: GAME_CONFIG_KEYS.MODEL,
      details: { model },
    })
  })
  return statusView(ctx)
}

function startJob(ctx, payload) {
  const { id_token, kind } = adminGameJobSchema.parse(payload)
  const admin = requireAdmin(ctx, id_token)
  const job = queueJob(ctx, admin, kind)
  return { job, ...statusView(ctx) }
}

export const gameHandlers = {
  [ACTIONS.ADMIN_GAME]: gameStatus,
  [ACTIONS.ADMIN_GAME_CONFIG]: setGameConfig,
  [ACTIONS.ADMIN_GAME_JOB_START]: startJob,
}
