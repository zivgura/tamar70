import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import { handleRequest } from './router.js'
import { dailyStats, israelDay } from './telemetry.js'

let ctx
const call = (action, payload) => handleRequest(JSON.stringify({ action, payload }), ctx)
const ok = (action, payload) => {
  const res = call(action, payload)
  if (!res.ok) throw new Error(`${action} failed: ${JSON.stringify(res.error)}`)
  return res.data
}
const error = (overrides = {}) => ({
  message: "Cannot read properties of undefined (reading 'id')",
  stack: 'at Story (Story.jsx:12)',
  path: '/story/st_x',
  release: 'abc123',
  user_agent: 'iPhone Safari',
  device: 'dev_aaaaaaaa',
  ...overrides,
})

beforeEach(() => {
  ctx = createMemoryContext({ now: '2026-12-01T22:30:00.000Z' })
  ok('site.get')
})

describe('client errors', () => {
  it('saves an error once and counts repeats', () => {
    expect(ok('client.error', error())).toEqual({ saved: true })
    ctx.setNow('2026-12-01T22:31:00.000Z')
    expect(ok('client.error', error({ device: 'dev_bbbbbbbb' }))).toEqual({ saved: false })
    const rows = ctx.db.all('ClientErrors')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ count: 2, last_seen: '2026-12-01T22:31:00.000Z' })
    expect(rows[0].id).toMatch(/^er_/)
  })

  it('keeps different errors apart', () => {
    ok('client.error', error())
    ok('client.error', error({ path: '/' }))
    expect(ctx.db.all('ClientErrors')).toHaveLength(2)
  })

  it('stops saving new errors past the hourly cap', () => {
    for (let i = 0; i < 70; i++) call('client.error', error({ message: `boom ${i}` }))
    expect(ctx.db.all('ClientErrors')).toHaveLength(60)
  })

  it('rejects an empty message', () => {
    expect(call('client.error', { message: '' }).error.code).toBe('validation')
  })
})

describe('visits', () => {
  it('counts a device once a day, by the Israel date', () => {
    const visit = { device: 'dev_aaaaaaaa', path: '/', has_code: true, first_visit: true }
    expect(ok('client.visit', visit)).toEqual({ saved: true })
    expect(ok('client.visit', visit)).toEqual({ saved: false })
    // 22:30 UTC is already the next day in Israel.
    expect(ctx.db.all('Visits')[0].date).toBe('2026-12-02')
    expect(israelDay('2026-12-01T21:59:00.000Z')).toBe('2026-12-01')
  })

  it('needs a device id', () => {
    expect(call('client.visit', { path: '/' }).error.code).toBe('validation')
  })
})

describe('stats', () => {
  it('adds up devices, new devices, stories and photos per day', () => {
    ok('client.visit', { device: 'dev_aaaaaaaa', first_visit: true, has_code: true })
    ok('client.visit', { device: 'dev_bbbbbbbb' })
    ctx.db.insert('Stories', { id: 'st_1', status: 'active', created_at: '2026-12-01T23:00:00Z' })
    ctx.db.insert('Stories', { id: 'st_2', status: 'deleted', created_at: '2026-12-01T23:00:00Z' })
    ctx.db.insert('Media', {
      id: 'md_1',
      upload_status: 'done',
      uploaded_at: '2026-11-30T10:00:00Z',
    })
    expect(dailyStats(ctx)).toEqual([
      { date: '2026-12-02', devices: 2, new_devices: 1, stories: 1, photos: 0 },
      { date: '2026-11-30', devices: 0, new_devices: 0, stories: 0, photos: 1 },
    ])
  })

  it('is for admins only', () => {
    expect(call('admin.stats', { id_token: 'x'.repeat(200) }).error.code).toBe('sign_in_required')
  })
})
