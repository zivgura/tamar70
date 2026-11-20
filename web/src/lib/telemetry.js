// The site reporting about itself to our own API: errors on people's phones, and one visit per
// device per day. Sent with sendBeacon, so it never slows a page down or shows an error itself.
import { ACTIONS } from '@tamar70/shared'
import { API_URL } from '../api/client.js'
import { readFamilyCode } from './familyCode.js'
import { readStored, writeStored } from './storage.js'

const RELEASE = import.meta.env.VITE_RELEASE ?? 'dev'
const MAX_ERRORS_PER_PAGE = 10
// Noise browsers report that isn't a bug in the site.
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i]

let errorsSent = 0
const errorsSeen = new Set()

function send(action, payload) {
  if (!API_URL || import.meta.env.MODE === 'test') return
  const body = JSON.stringify({ action, payload })
  try {
    if (navigator.sendBeacon?.(API_URL, new Blob([body], { type: 'text/plain' }))) return
    fetch(API_URL, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {})
  } catch {
    // Reporting must never break the page.
  }
}

/** A random id for this device, made once. Not tied to a person. */
export function deviceId() {
  let id = readStored('device')
  if (!id) {
    const bytes = crypto.getRandomValues(new Uint8Array(12))
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    writeStored('device', id)
  }
  return id
}

/** What gets sent for an error, or null if it shouldn't be. */
export function errorReport(error, location = window.location) {
  const message = String(error?.message ?? error ?? '').slice(0, 500)
  if (!message || IGNORED.some((re) => re.test(message))) return null
  return {
    message,
    stack: String(error?.stack ?? '').slice(0, 4000),
    path: location.pathname.slice(0, 300),
    release: RELEASE,
    user_agent: navigator.userAgent.slice(0, 300),
    device: deviceId(),
  }
}

export function reportError(error) {
  const report = errorReport(error)
  if (!report || errorsSent >= MAX_ERRORS_PER_PAGE) return
  const key = `${report.message}|${report.path}`
  if (errorsSeen.has(key)) return
  errorsSeen.add(key)
  errorsSent++
  send(ACTIONS.CLIENT_ERROR, report)
}

/** Catches errors nobody handled: script errors and failed promises. */
export function installErrorReporting() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason))
}

const today = () => new Date().toLocaleDateString('en-CA')

/** One visit a day from this device. */
export function recordVisit(location = window.location) {
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/_')) return
  if (readStored('visitDay') === today()) return
  const firstVisit = !readStored('device')
  send(ACTIONS.CLIENT_VISIT, {
    device: deviceId(),
    path: location.pathname.slice(0, 300),
    has_code: Boolean(readFamilyCode()),
    first_visit: firstVisit,
  })
  writeStored('visitDay', today())
}
