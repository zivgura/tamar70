// In-memory stand-ins for the Apps Script services, for tests. Rows go through the real
// codec, so tests also cover how values survive a round trip through Sheet cells.
import { createHash, randomBytes } from 'node:crypto'
import { decodeRow, encodeRow } from '@tamar70/shared'

// Like Sheets: a leading apostrophe marks the cell as text and isn't part of the stored value.
const asSheetsStores = (cells) =>
  cells.map((c) => (typeof c === 'string' && c.startsWith("'") ? c.slice(1) : c))

export function createMemoryDb() {
  const tabs = new Map() // name -> { headers, rows }

  const tab = (name) => {
    if (!tabs.has(name)) throw new Error(`Missing tab: ${name}`)
    return tabs.get(name)
  }

  return {
    tabs,
    all: (name) => tab(name).rows.map((r) => decodeRow(name, tab(name).headers, r)),
    insert(name, obj) {
      const t = tab(name)
      t.rows.push(asSheetsStores(encodeRow(name, t.headers, obj)))
    },
    update(name, keyCol, keyValue, patch) {
      const t = tab(name)
      const k = t.headers.indexOf(keyCol)
      const i = t.rows.findIndex((r) => String(r[k]) === String(keyValue))
      if (k === -1 || i === -1) return false
      t.rows[i] = asSheetsStores(
        encodeRow(name, t.headers, { ...decodeRow(name, t.headers, t.rows[i]), ...patch }),
      )
      return true
    },
    ensureTable(name, columns) {
      if (!tabs.has(name)) tabs.set(name, { headers: [], rows: [] })
      const t = tabs.get(name)
      for (const c of columns) if (!t.headers.includes(c)) t.headers.push(c)
    },
  }
}

/**
 * A Drive that records upload sessions. `browserUpload(url, bytes)` plays the browser's part:
 * it turns a session into a file, as Drive does when the upload completes.
 */
export function createFakeDrive({ folderId = 'folder-originals' } = {}) {
  const sessions = new Map()
  const files = new Map()
  let n = 0
  return {
    folderId,
    sessions,
    files,
    failNextSession: false,
    createUploadSession(request) {
      if (this.failNextSession) {
        this.failNextSession = false
        throw new Error('Drive said no')
      }
      const url = `https://upload.example/session-${++n}`
      sessions.set(url, request)
      return url
    },
    browserUpload(url, bytes) {
      const s = sessions.get(url)
      const id = `drivefile${String(++n).padStart(6, '0')}`
      files.set(id, {
        id,
        created: this.clock?.() ?? '2026-12-01T10:00:00.000Z',
        parents: [folderId],
        size: bytes ?? s.bytes,
        mimeType: s.mime,
        appProperties: { ...s.properties },
        width: 4032,
        height: 3024,
      })
      return id
    },
    getFile: (id) => files.get(id) ?? null,
    listFiles() {
      return [...files.values()]
        .filter((f) => !this.trashed.has(f.id))
        .map((f) => ({ id: f.id, created: f.created }))
    },
    trashed: new Set(),
    thumbnail: (id) => (files.has(id) ? `data:image/png;base64,${id}` : null),
    trash(id) {
      this.trashed.add(id)
    },
  }
}

export function createMemoryContext({ now = '2026-12-01T10:00:00.000Z' } = {}) {
  const cacheStore = new Map()
  let version = 0
  let clock = now
  return {
    db: createMemoryDb(),
    drive: Object.assign(createFakeDrive(), { clock: () => clock }),
    mail: {
      sent: [],
      send(message) {
        this.sent.push(message)
      },
    },
    schedule: {
      installs: 0,
      ensure() {
        this.installs++
      },
    },
    now: () => clock,
    ownerEmail: () => 'owner@example.test',
    setNow: (iso) => (clock = iso),
    log: { error: () => {}, info: () => {} },
    lock: { run: (fn) => fn() },
    cache: {
      store: cacheStore,
      get: (k) => cacheStore.get(k) ?? null,
      put: (k, v) => cacheStore.set(k, v),
      remove: (k) => cacheStore.delete(k),
    },
    crypto: {
      sha256: (text) => createHash('sha256').update(text, 'utf8').digest('hex'),
      randomBytes: (n) => Array.from(randomBytes(n)),
      randomId: (n) => randomBytes(n).toString('hex').slice(0, n),
    },
    schemaVersion: { get: () => version, set: (v) => (version = v) },
    // Tests register tokens: google.tokens.set(token, claims). Unknown tokens are rejected.
    google: {
      tokens: new Map(),
      calls: 0,
      tokenInfo(token) {
        this.calls++
        return this.tokens.get(token) ?? null
      },
    },
  }
}
