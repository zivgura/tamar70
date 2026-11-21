import { ERROR_CODES } from '@tamar70/shared'
import { ApiError } from '../core/errors.js'
import { HOUSEKEEPING_MINUTES } from '../core/housekeeping.js'
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

    // Copies of the whole Sheet in the Backups folder.
    backups: {
      folderUrl: () => DriveApp.getFolderById(props().getProperty('BACKUPS_FOLDER_ID')).getUrl(),
      copySheet(name) {
        const folder = DriveApp.getFolderById(props().getProperty('BACKUPS_FOLDER_ID'))
        const copy = DriveApp.getFileById(sheetId).makeCopy(name, folder)
        return { id: copy.getId(), url: copy.getUrl() }
      },
      /** Sheets in the Backups folder: [{ id, created }]. */
      list() {
        const out = []
        const it = DriveApp.getFolderById(props().getProperty('BACKUPS_FOLDER_ID')).searchFiles(
          "trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet'",
        )
        while (it.hasNext()) {
          const f = it.next()
          out.push({ id: f.getId(), created: f.getDateCreated().toISOString() })
        }
        return out
      },
      trash: (id) => DriveApp.getFileById(id).setTrashed(true),
    },
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

    mail: {
      send: ({ to, subject, body }) => MailApp.sendEmail({ to, subject, body, name: 'תמר בת 70' }),
    },

    schedule: {
      /** Installs the housekeeping timer unless it's already there. */
      ensure() {
        const exists = ScriptApp.getProjectTriggers().some(
          (t) => t.getHandlerFunction() === 'housekeeping',
        )
        if (exists) return false
        ScriptApp.newTrigger('housekeeping').timeBased().everyMinutes(HOUSEKEEPING_MINUTES).create()
        return true
      },
    },

    google: {
      /** Google's own check of a sign-in ID token: its claims, or null if Google rejects it. */
      tokenInfo(idToken) {
        const response = UrlFetchApp.fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
          { muteHttpExceptions: true },
        )
        const code = response.getResponseCode()
        if (code === 400) return null
        if (code !== 200) throw new Error(`tokeninfo ${code}`)
        return JSON.parse(response.getContentText())
      },

      /**
       * A Google Doc's text, fetched like any visitor would: no credentials, so only docs
       * shared "anyone with the link" can be read. Null when Google won't hand it out.
       */
      docText(docId) {
        // Shared docs answer with a redirect to a googleusercontent.com download; private
        // ones redirect to the Google sign-in page. Follow only the first kind.
        let url = `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=txt`
        for (let hop = 0; hop < 4; hop++) {
          const response = UrlFetchApp.fetch(url, {
            muteHttpExceptions: true,
            followRedirects: false,
          })
          const code = response.getResponseCode()
          const headers = response.getHeaders()
          if (code >= 300 && code < 400) {
            const next = String(headers.Location ?? headers.location ?? '')
            if (!/^https:\/\/[a-z0-9-]+\.(googleusercontent\.com|google\.com)\//.test(next))
              return null
            if (/^https:\/\/accounts\.google\.com\//.test(next)) return null
            url = next
            continue
          }
          if (code !== 200) return null
          const type = String(headers['Content-Type'] ?? headers['content-type'] ?? '')
          if (!type.startsWith('text/plain')) return null
          return response.getContentText('UTF-8')
        }
        return null
      },
    },

    schemaVersion: {
      get: () => Number(props().getProperty('SCHEMA_VERSION') || 0),
      set: (v) => props().setProperty('SCHEMA_VERSION', String(v)),
    },
  }
}
