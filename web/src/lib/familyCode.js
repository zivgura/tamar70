import { readStored, writeStored } from './storage.js'

// The family link is https://tamar70.web.app/?k=CODE. The code is what lets someone add a
// memory. It's kept on the device and taken out of the address bar, so a screenshot or a
// copied page link doesn't pass it on by accident.
const KEY = 'familyCode'

export function captureFamilyCode(location = window.location, history = window.history) {
  const url = new URL(location.href)
  const code = url.searchParams.get('k')
  if (!code) return readFamilyCode()
  writeStored(KEY, code.trim())
  url.searchParams.delete('k')
  history.replaceState(history.state, '', url.pathname + url.search + url.hash)
  return code.trim()
}

export function readFamilyCode() {
  return readStored(KEY, '')
}
