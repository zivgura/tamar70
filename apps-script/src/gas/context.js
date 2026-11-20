import { ERROR_CODES } from '@tamar70/shared'
import { ApiError } from '../core/errors.js'
import { createDrive } from './drive.js'
import { createSheetsDb } from './sheetsDb.js'

const LOCK_WAIT_MS = 10_000
const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export const props = () => PropertiesService.getScriptProperties()

function toHex(bytes) {
  return bytes.map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('')
}

// Utilities.getUuid() returns random (version 4) UUIDs: 122 random bits each.
function randomBytes(n) {
  const out = []
  while (out.length < n) {
    const hex = Utilities.getUuid().replace(/-/g, '')
    for (let i = 0; i < hex.length && out.length < n; i += 2) {
      out.push(parseInt(hex.slice(i, i + 2), 16))
    }
  }
  return out
}

/** Everything the core needs, backed by Apps Script services. */
export function createContext() {
  const sheetId = props().getProperty('SHEET_ID')
  if (!sheetId) throw new Error('SHEET_ID is not set. Run setup() once from the editor.')
  const cache = CacheService.getScriptCache()

  let drive = null
  return {
    db: createSheetsDb(sheetId),
    // Created on first use, so requests that don't touch Drive don't need its folder.
    get drive() {
      return (drive ??= createDrive(props().getProperty('ORIGINALS_FOLDER_ID')))
    },
    now: () => new Date().toISOString(),
    // The script runs as its owner ("Execute as: Me"), so this is the owner account.
    ownerEmail: () => Session.getEffectiveUser().getEmail(),
    log: { error: (msg) => console.error(msg), info: (msg) => console.log(msg) },

    lock: {
      run(fn) {
        const lock = LockService.getScriptLock()
        if (!lock.tryLock(LOCK_WAIT_MS)) {
          throw new ApiError(ERROR_CODES.BUSY, 'The server is busy, try again')
        }
        try {
          const result = fn()
          SpreadsheetApp.flush()
          return result
        } finally {
          lock.releaseLock()
        }
      },
    },

    cache: {
      get: (key) => cache.get(key),
      put: (key, value, seconds) => cache.put(key, value, seconds),
      remove: (key) => cache.remove(key),
    },

    crypto: {
      sha256: (text) =>
        toHex(
          Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8),
        ),
      randomBytes,
      randomId: (n) =>
        randomBytes(n)
          .map((b) => ID_ALPHABET[b % ID_ALPHABET.length])
          .join(''),
    },

    schemaVersion: {
      get: () => Number(props().getProperty('SCHEMA_VERSION') || 0),
      set: (v) => props().setProperty('SCHEMA_VERSION', String(v)),
    },
  }
}
