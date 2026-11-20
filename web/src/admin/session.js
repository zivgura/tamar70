// The admin's Google sign-in, kept for this browser tab only (sessionStorage). The token is a
// Google ID token: it proves who signed in for about an hour, and grants nothing on its own.
const KEY = 'tamar70.adminToken'
// Treat a token as expired a little early, so a call never arrives with a dead one.
const MARGIN_SECONDS = 120

/** The claims inside a JWT (not verified here: the server checks the token with Google). */
export function readClaims(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      Array.from(atob(part), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function isFresh(token, nowMs = Date.now()) {
  const exp = Number(readClaims(token)?.exp ?? 0)
  return exp * 1000 - MARGIN_SECONDS * 1000 > nowMs
}

export function loadToken() {
  try {
    const token = window.sessionStorage.getItem(KEY)
    return token && isFresh(token) ? token : null
  } catch {
    return null
  }
}

export function saveToken(token) {
  try {
    window.sessionStorage.setItem(KEY, token)
  } catch {
    // Still works for this page view.
  }
}

export function clearToken() {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // nothing to do
  }
}
