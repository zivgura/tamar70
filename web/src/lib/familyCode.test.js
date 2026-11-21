import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captureFamilyCode, readFamilyCode } from './familyCode.js'

describe('family code', () => {
  beforeEach(() => window.localStorage.clear())

  it('keeps the code from the link and removes it from the address bar', () => {
    const history = { state: null, replaceState: vi.fn() }
    const code = captureFamilyCode(
      { href: 'https://tamar70.web.app/corner/journey?k=9u44tmn4&x=1#top' },
      history,
    )
    expect(code).toBe('9u44tmn4')
    expect(readFamilyCode()).toBe('9u44tmn4')
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/corner/journey?x=1#top')
  })

  it('stores the code in lowercase, as the server makes them', () => {
    captureFamilyCode({ href: 'https://tamar70.web.app/?k=%20AbC23%20' }, { replaceState() {} })
    expect(readFamilyCode()).toBe('abc23')
  })

  it('remembers the code on later visits without a link', () => {
    captureFamilyCode({ href: 'https://tamar70.web.app/?k=abc' }, { replaceState() {} })
    const history = { replaceState: vi.fn() }
    expect(captureFamilyCode({ href: 'https://tamar70.web.app/' }, history)).toBe('abc')
    expect(history.replaceState).not.toHaveBeenCalled()
  })
})
