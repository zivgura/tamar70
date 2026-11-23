import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './useWakeLock.js'

describe('useWakeLock', () => {
  afterEach(() => {
    delete navigator.wakeLock
  })

  it('keeps the screen on while active and lets go afterwards', async () => {
    const lock = { released: false, release: vi.fn(async () => (lock.released = true)) }
    navigator.wakeLock = { request: vi.fn().mockResolvedValue(lock) }
    const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: false } })
    expect(navigator.wakeLock.request).not.toHaveBeenCalled()

    rerender({ on: true })
    await vi.waitFor(() => expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen'))
    rerender({ on: false })
    expect(lock.release).toHaveBeenCalled()
  })

  it('does nothing where the browser cannot keep the screen on', () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow()
  })
})
