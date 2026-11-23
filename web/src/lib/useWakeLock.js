import { useEffect } from 'react'

/**
 * Keeps the phone's screen on while `active` (e.g. while photos upload): a screen that turns
 * off can pause the upload. Asks again when the page comes back to the front, since the
 * browser drops the lock when it's hidden. Does nothing where the browser can't.
 */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !navigator.wakeLock?.request) return undefined
    let lock = null
    let stopped = false

    async function acquire() {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (stopped) lock.release().catch(() => {})
      } catch {
        // Low battery mode or not allowed: uploading still works, just without the lock.
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [active])
}
