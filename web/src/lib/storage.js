// Small values kept on this device (family code, name, drafts, own stories). Storage can be
// missing or throw (private mode, full quota), so every access is guarded.
const PREFIX = 'tamar70.'

export function readStored(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeStored(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeStored(key) {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    // nothing to do
  }
}
