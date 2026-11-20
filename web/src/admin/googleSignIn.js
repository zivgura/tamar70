// Google Identity Services ("Sign in with Google"), loaded only on the admin pages.
const SCRIPT_URL = 'https://accounts.google.com/gsi/client'

let loading = null

/** Resolves with window.google.accounts.id once the library is ready. */
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google sign-in did not load'))
    script.onerror = () => {
      loading = null
      reject(new Error('Google sign-in did not load'))
    }
    document.head.append(script)
  })
  return loading
}
