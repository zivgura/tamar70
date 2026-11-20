import { beforeEach, describe, expect, it } from 'vitest'
import { readStored, writeStored } from './storage.js'
import { deviceId, errorReport, recordVisit } from './telemetry.js'

const at = (pathname) => ({ pathname })

beforeEach(() => window.localStorage.clear())

describe('telemetry', () => {
  it('makes one random device id and keeps it', () => {
    const id = deviceId()
    expect(id).toMatch(/^[0-9a-f]{24}$/)
    expect(deviceId()).toBe(id)
  })

  it('describes an error with where it happened and which build', () => {
    const report = errorReport(new TypeError('x is undefined'), at('/story/st_1'))
    expect(report).toMatchObject({
      message: 'x is undefined',
      path: '/story/st_1',
      release: 'dev',
      device: deviceId(),
    })
    expect(report.stack).toContain('TypeError')
  })

  it('ignores browser noise and empty errors', () => {
    expect(errorReport(new Error('ResizeObserver loop limit exceeded'))).toBeNull()
    expect(errorReport('Script error.')).toBeNull()
    expect(errorReport(undefined)).toBeNull()
  })

  it('records a visit once a day, never on admin pages', () => {
    recordVisit(at('/admin'))
    expect(readStored('visitDay')).toBeNull()
    recordVisit(at('/'))
    expect(readStored('visitDay')).toBe(new Date().toLocaleDateString('en-CA'))
    expect(readStored('device')).toBeTruthy()
    writeStored('visitDay', '2000-01-01')
    recordVisit(at('/'))
    expect(readStored('visitDay')).not.toBe('2000-01-01')
  })
})
