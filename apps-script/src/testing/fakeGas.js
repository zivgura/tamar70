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
  const properties = new Map([['SHEET_ID', 'sheet-1']])
  const cache = new Map()
  const logs = []

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
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      // Apps Script returns signed bytes (-128..127).
      computeDigest: (alg, text) =>
        Array.from(createHash(alg).update(text, 'utf8').digest(), (b) => (b > 127 ? b - 256 : b)),
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

  return { globals, spreadsheet, properties, cache, logs }
}
