import { GOOGLE_CLIENT_ID } from '@tamar70/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import { runQueuedJobs } from './gameJobs.js'
import { handleRequest } from './router.js'

let ctx
const ADMIN = 'A'.repeat(200)
const OUTSIDER = 'B'.repeat(200)

const call = (action, payload) => handleRequest(JSON.stringify({ action, payload }), ctx)
const ok = (action, payload) => {
  const res = call(action, payload)
  if (!res.ok) throw new Error(`${action} failed: ${JSON.stringify(res.error)}`)
  return res.data
}

const NOW = Date.parse('2026-12-01T10:00:00.000Z') / 1000
const claims = (email) => ({
  aud: GOOGLE_CLIENT_ID,
  iss: 'https://accounts.google.com',
  email,
  email_verified: 'true',
  exp: String(NOW + 3000),
})

const later = (minutes) =>
  ctx.setNow(new Date(Date.parse(ctx.now()) + minutes * 60_000).toISOString())

beforeEach(() => {
  ctx = createMemoryContext()
  ok('site.get')
  ctx.google.tokens.set(ADMIN, claims('owner@example.test'))
  ctx.google.tokens.set(OUTSIDER, claims('someone@example.test'))
})

describe('escape room status', () => {
  it('is for admins only', () => {
    expect(call('admin.game', { id_token: OUTSIDER }).error.code).toBe('not_admin')
    expect(call('admin.gameJobStart', { id_token: OUTSIDER, kind: 'check' }).error.code).toBe(
      'not_admin',
    )
  })

  it('starts empty, with Opus 5.5 and no key', () => {
    expect(ok('admin.game', { id_token: ADMIN })).toEqual({
      ai_configured: false,
      model: 'claude-opus-5-5',
      models: [
        { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', input: 4, output: 20 },
        { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', input: 2, output: 10 },
      ],
      counts: { facts: 0, facts_kept: 0, puzzles: 0, puzzles_approved: 0 },
      jobs: [],
    })
  })

  it('changes the model, and refuses unknown ones', () => {
    expect(ok('admin.gameConfig', { id_token: ADMIN, model: 'claude-sonnet-5-5' }).model).toBe(
      'claude-sonnet-5-5',
    )
    expect(ok('admin.game', { id_token: ADMIN }).model).toBe('claude-sonnet-5-5')
    expect(call('admin.gameConfig', { id_token: ADMIN, model: 'gpt' }).error.code).toBe(
      'validation',
    )
    expect(ctx.db.all('AuditLog').at(-1).action).toBe('game.model')
  })
})

describe('escape room jobs', () => {
  it('needs the API key before anything runs', () => {
    expect(call('admin.gameJobStart', { id_token: ADMIN, kind: 'check' }).error.code).toBe(
      'ai_not_configured',
    )
    expect(ctx.jobs.starts).toBe(0)
  })

  it('queues a check, runs it in the background and records tokens and cost', () => {
    ctx.ai.key = 'sk-test'
    const started = ok('admin.gameJobStart', { id_token: ADMIN, kind: 'check' })
    expect(started.job).toMatchObject({ kind: 'check', status: 'queued' })
    expect(started.jobs).toHaveLength(1)
    expect(ctx.jobs.starts).toBe(1)

    ctx.ai.reply('שלום', { input_tokens: 1000, output_tokens: 100 })
    expect(runQueuedJobs(ctx)).toBe(1)
    expect(ctx.jobs.clears).toBe(1)

    const request = ctx.ai.requests[0]
    expect(request.model).toBe('claude-opus-5-5')
    expect(request.max_tokens).toBe(20)

    const [job] = ok('admin.game', { id_token: ADMIN }).jobs
    expect(job).toMatchObject({
      status: 'done',
      progress: { reply: 'שלום', model: 'claude-opus-5-5' },
      tokens_in: 1000,
      tokens_out: 100,
      // 1000 × $4 + 100 × $20 per million tokens
      cost_usd: 0.006,
      error: null,
    })
  })

  it('runs one job at a time', () => {
    ctx.ai.key = 'sk-test'
    ok('admin.gameJobStart', { id_token: ADMIN, kind: 'check' })
    expect(call('admin.gameJobStart', { id_token: ADMIN, kind: 'check' }).error.code).toBe(
      'job_running',
    )
  })

  it('explains a failure from Claude in plain words', () => {
    ctx.ai.key = 'sk-wrong'
    ok('admin.gameJobStart', { id_token: ADMIN, kind: 'check' })
    ctx.ai.fail(401, 'invalid x-api-key')
    runQueuedJobs(ctx)
    const [job] = ok('admin.game', { id_token: ADMIN }).jobs
    expect(job.status).toBe('failed')
    expect(job.error).toContain('CLAUDE_API_KEY')

    // A new job can start once the last one ended.
    expect(ok('admin.gameJobStart', { id_token: ADMIN, kind: 'check' }).job.status).toBe('queued')
  })

  it('gives up on a job whose run died, so a new one can start', () => {
    ctx.ai.key = 'sk-test'
    ok('admin.gameJobStart', { id_token: ADMIN, kind: 'check' })
    later(10)
    const [job] = ok('admin.game', { id_token: ADMIN }).jobs
    expect(job.status).toBe('failed')
    expect(job.error).toContain('יותר מדי זמן')
    expect(ok('admin.gameJobStart', { id_token: ADMIN, kind: 'check' }).job.status).toBe('queued')
  })

  it('starts the trigger again for a job left waiting', () => {
    ctx.ai.key = 'sk-test'
    ok('admin.gameJobStart', { id_token: ADMIN, kind: 'check' })
    later(1)
    ok('admin.game', { id_token: ADMIN })
    expect(ctx.jobs.starts).toBe(1)
    later(2)
    ok('admin.game', { id_token: ADMIN })
    expect(ctx.jobs.starts).toBe(2)
  })

  it('marks the job failed when its trigger cannot be created', () => {
    ctx.ai.key = 'sk-test'
    ctx.jobs.failNextStart = true
    const { job } = ok('admin.gameJobStart', { id_token: ADMIN, kind: 'check' })
    expect(job.status).toBe('failed')
    expect(ok('admin.game', { id_token: ADMIN }).jobs[0].status).toBe('failed')
  })

  it('does nothing when no job is waiting', () => {
    expect(runQueuedJobs(ctx)).toBe(0)
  })
})
