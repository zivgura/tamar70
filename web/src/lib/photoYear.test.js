import { describe, expect, it } from 'vitest'
import { isBadYear, photoYear } from './photoYear.js'

describe('photoYear', () => {
  it('accepts years in range and rejects the rest', () => {
    expect(photoYear('1986')).toBe(1986)
    expect(photoYear('1850')).toBeNull()
    expect(photoYear('')).toBeNull()
  })
  it('flags only non-empty bad input', () => {
    expect(isBadYear('')).toBe(false)
    expect(isBadYear('1986')).toBe(false)
    expect(isBadYear('86')).toBe(true)
    expect(isBadYear('1850')).toBe(true)
  })
})
