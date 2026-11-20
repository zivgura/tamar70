import { describe, expect, it, vi } from 'vitest'
import { api, apiCall, ApiError, newEditToken } from './client.js'

const URL = 'https://script.example/exec'
const reply = (body, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }))
const opts = (fetchImpl) => ({ url: URL, fetchImpl, baseDelayMs: 0 })

describe('apiCall', () => {
  it('POSTs the action as text/plain JSON and returns data', async () => {
    const fetchImpl = vi.fn(() => reply({ ok: true, data: { site_status: 'collecting' } }))
    await expect(api.site(opts(fetchImpl))).resolves.toEqual({ site_status: 'collecting' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe(URL)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toMatch(/^text\/plain/)
    expect(JSON.parse(init.body)).toEqual({ action: 'site.get', payload: {} })
  })

  it('turns an error envelope into an ApiError without retrying', async () => {
    const fetchImpl = vi.fn(() =>
      reply({ ok: false, error: { code: 'bad_family_code', message: 'wrong' } }),
    )
    const err = await apiCall('stories.submit', {}, opts(fetchImpl)).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('bad_family_code')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries when the server is busy, then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => reply({ ok: false, error: { code: 'busy' } }))
      .mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
      .mockImplementationOnce(() => reply({ ok: true, data: [] }))
    await expect(api.categories(opts(fetchImpl))).resolves.toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('gives up after the retries run out', async () => {
    const fetchImpl = vi.fn(() => reply({}, 503))
    const err = await apiCall('site.get', {}, { ...opts(fetchImpl), retries: 2 }).catch((e) => e)
    expect(err.code).toBe('network')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('fails clearly before the API is deployed', async () => {
    await expect(apiCall('site.get', {}, { url: '' })).rejects.toMatchObject({
      code: 'not_configured',
    })
  })
})

describe('newEditToken', () => {
  it('is long, random and URL-safe', () => {
    const a = newEditToken()
    expect(a).toMatch(/^[0-9a-f]{48}$/)
    expect(newEditToken()).not.toBe(a)
  })
})
