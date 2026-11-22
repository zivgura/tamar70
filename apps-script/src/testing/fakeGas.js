// Minimal fakes of the Apps Script services the bundle uses, for running dist/Code.js in Node.
// Only the methods the code calls exist, so a call to anything else fails loudly.
import { createHash, randomUUID } from 'node:crypto'

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    Object.assign(this, { sheet, row, col, numRows, numCols })
  }
  getValues() {
    const out = []
    for (let r = 0; r < this.numRows; r++) {
      const src = this.sheet.cells[this.row - 1 + r] || []
      out.push(Array.from({ length: this.numCols }, (_, c) => src[this.col - 1 + c] ?? ''))
    }
    return out
  }
  setValues(values) {
    values.forEach((rowValues, r) => {
      const target = (this.sheet.cells[this.row - 1 + r] ||= [])
      rowValues.forEach((v, c) => (target[this.col - 1 + c] = FakeSheet.stored(v)))
    })
    return this
  }
  setNumberFormat() {
    return this
  }
  setFontWeight() {
    return this
  }
}

class FakeSheet {
  // Sheets: a leading apostrophe forces text and isn't part of the value; "=..." would be a formula.
  static stored(v) {
    if (typeof v !== 'string') return v
    if (v.startsWith("'")) return v.slice(1)
    if (v.startsWith('=')) throw new Error(`Formula written to a cell: ${v}`)
    return v
  }
  constructor(name) {
    this.name = name
    this.cells = []
  }
  getName() {
    return this.name
  }
  getLastRow() {
    return this.cells.length
  }
  getLastColumn() {
    return Math.max(0, ...this.cells.map((r) => r.length))
  }
  getMaxRows() {
    return Math.max(1000, this.cells.length)
  }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new FakeRange(this, row, col, numRows, numCols)
  }
  getDataRange() {
    return new FakeRange(this, 1, 1, this.getLastRow(), this.getLastColumn())
  }
  appendRow(values) {
    this.cells.push(values.map(FakeSheet.stored))
  }
  setFrozenRows() {}
}

class FakeSpreadsheet {
  getSpreadsheetTimeZone() {
    return 'Asia/Jerusalem'
  }
  constructor() {
    this.sheets = [new FakeSheet('Sheet1')]
  }
  getSheetByName(name) {
    return this.sheets.find((s) => s.name === name) || null
  }
  getSheets() {
    return [...this.sheets]
  }
  insertSheet(name) {
    const s = new FakeSheet(name)
    this.sheets.push(s)
    return s
  }
  deleteSheet(sheet) {
    this.sheets = this.sheets.filter((s) => s !== sheet)
  }
}

export function createFakeGas({ owner = 'owner@example.test' } = {}) {
  const spreadsheet = new FakeSpreadsheet()
  const properties = new Map([
    ['SHEET_ID', 'sheet-1'],
    ['ORIGINALS_FOLDER_ID', 'folder-originals'],
  ])
  const fetches = []
  const trashed = []
  const sharing = []
  const cache = new Map()
  const logs = []

  const triggers = []
  const mails = []
  const globals = {
    SpreadsheetApp: {
      openById: (id) => {
        if (id !== 'sheet-1') throw new Error(`No spreadsheet ${id}`)
        return spreadsheet
      },
      flush: () => {},
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (properties.has(k) ? properties.get(k) : null),
        setProperty: (k, v) => properties.set(k, String(v)),
        setProperties: (obj) => Object.entries(obj).forEach(([k, v]) => properties.set(k, v)),
        deleteProperty: (k) => properties.delete(k),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => {
          if (v.length > 100_000) throw new Error('Cache value too large')
          cache.set(k, v)
        },
        remove: (k) => cache.delete(k),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
    },
    Utilities: {
      getUuid: () => randomUUID(),
      // Only the two patterns the code uses.
      formatDate: (date, timeZone, pattern) => {
        const parts = Object.fromEntries(
          new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
          })
            .formatToParts(date)
            .map((p) => [p.type, p.value]),
        )
        if (pattern === 'yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`
        if (pattern === 'HH:mm:ss') return `${parts.hour}:${parts.minute}:${parts.second}`
        throw new Error(`Unsupported pattern ${pattern}`)
      },
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      // Apps Script returns signed bytes (-128..127).
      base64Encode: (bytes) => Buffer.from(bytes.map((b) => (b + 256) % 256)).toString('base64'),
      computeDigest: (alg, text) =>
        Array.from(createHash(alg).update(text, 'utf8').digest(), (b) => (b > 127 ? b - 256 : b)),
    },
    ScriptApp: {
      getOAuthToken: () => 'owner-token',
      getProjectTriggers: () => triggers.map((name) => ({ getHandlerFunction: () => name })),
      newTrigger: (name) => {
        const chain = {
          timeBased: () => chain,
          everyMinutes: () => chain,
          after: () => chain,
          create: () => triggers.push(name),
        }
        return chain
      },
      deleteTrigger: (t) => {
        const i = triggers.indexOf(t.getHandlerFunction())
        if (i !== -1) triggers.splice(i, 1)
      },
    },
    MailApp: { sendEmail: (message) => mails.push(message) },
    DriveApp: {
      getFolderById: () => ({ searchFiles: () => ({ hasNext: () => false }) }),
      getFileById: (id) => ({
        getThumbnail: () => ({
          getContentType: () => 'image/png',
          getBytes: () => [1, 2, 3],
        }),
        setTrashed: (v) => v && trashed.push(id),
        setSharing: (access) => sharing.push([id, access]),
      }),
    },
    // Answers like Drive: a session URL for an upload request, file metadata for a GET.
    UrlFetchApp: {
      fetch: (url, options = {}) => {
        fetches.push({ url, options })
        if (url === 'https://api.anthropic.com/v1/messages') {
          const body = JSON.stringify({
            content: [{ type: 'text', text: 'שלום' }],
            usage: { input_tokens: 20, output_tokens: 2 },
            stop_reason: 'end_turn',
          })
          return { getResponseCode: () => 200, getHeaders: () => ({}), getContentText: () => body }
        }
        if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
          return { getResponseCode: () => 400, getHeaders: () => ({}), getContentText: () => '{}' }
        }
        const isUpload = url.startsWith('https://www.googleapis.com/upload/drive/v3/files')
        const id = url.split('/').pop().split('?')[0]
        const session = fetches.find((f) => f.url.includes('uploadType=resumable'))
        const meta = session ? JSON.parse(session.options.payload) : {}
        const body = isUpload
          ? ''
          : JSON.stringify({
              id,
              parents: meta.parents,
              size: '1234',
              mimeType: 'image/jpeg',
              appProperties: meta.appProperties,
              imageMediaMetadata: { width: 10, height: 10 },
            })
        return {
          getResponseCode: () => 200,
          getHeaders: () => (isUpload ? { location: 'https://upload.example/session-1' } : {}),
          getContentText: () => body,
        }
      },
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => owner }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (content) => ({
        content,
        mime: null,
        setMimeType(m) {
          this.mime = m
          return this
        },
      }),
    },
    console: {
      log: (...a) => logs.push(['log', a.join(' ')]),
      error: (...a) => logs.push(['error', a.join(' ')]),
    },
  }

  return {
    globals,
    spreadsheet,
    properties,
    cache,
    logs,
    fetches,
    trashed,
    triggers,
    mails,
    sharing,
  }
}
