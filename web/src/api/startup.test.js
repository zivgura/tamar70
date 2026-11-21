import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeStored } from '../lib/storage.js'
import { api } from './client.js'
import { savedBootstrap } from './queries.js'

const site = (overrides) => ({
  site: { site_status: 'collecting', birthday_date: '2027-02-07', ...overrides },
})
const at = (iso) => new Date(iso)

afterEach(() => {
  window.__tamar70Boot = undefined
  vi.restoreAllMocks()
})

describe('saved site data', () => {
  it('is used for a few days while collecting', () => {
    writeStored('bootstrap', { at: at('2026-12-01T10:00:00').getTime(), data: site() })
    expect(savedBootstrap(at('2026-12-02T10:00:00'))?.data).toEqual(site())
    expect(savedBootstrap(at('2026-12-05T10:00:00'))).toBeNull() // too old
  })

  it('is never used from the birthday on while it still says collecting', () => {
    writeStored('bootstrap', { at: at('2027-02-06T22:00:00').getTime(), data: site() })
    expect(savedBootstrap(at('2027-02-07T08:00:00'))).toBeNull()
    writeStored('bootstrap', {
      at: at('2027-02-07T09:00:00').getTime(),
      data: site({ site_status: 'published' }),
    })
    expect(savedBootstrap(at('2027-02-07T10:00:00'))).not.toBeNull()
  })
})

describe('the early bootstrap call', () => {
  it('is used once when index.html already started it', async () => {
    window.__tamar70Boot = Promise.resolve({ ok: true, data: { from: 'early' } })
    expect(await api.bootstrap()).toEqual({ from: 'early' })
    expect(window.__tamar70Boot).toBeUndefined()
  })

  it('falls back to a normal call when the early one failed', async () => {
    window.__tamar70Boot = Promise.resolve(null)
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, data: { from: 'retry' } })))
    expect(await api.bootstrap()).toEqual({ from: 'retry' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
