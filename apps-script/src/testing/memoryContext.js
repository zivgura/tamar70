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

export function createMemoryContext({ now = '2026-12-01T10:00:00.000Z' } = {}) {
  const cacheStore = new Map()
  let version = 0
  let clock = now
  return {
    db: createMemoryDb(),
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
  }
}
