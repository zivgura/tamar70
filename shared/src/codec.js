import { T, TABLES } from './tables.js'

// Sheets turns text that starts with these into a formula. A leading apostrophe makes the cell
// plain text; Sheets hides it and doesn't return it when the cell is read back.
const FORMULA_START = /^[=+\-@]/

function escapeText(text) {
  return FORMULA_START.test(text) ? `'${text}` : text
}

function encodeValue(value, type) {
  if (value === undefined || value === null) return ''
  switch (type) {
    case T.JSON:
      return escapeText(JSON.stringify(value))
    case T.BOOLEAN:
      return value ? 'TRUE' : 'FALSE'
    case T.NUMBER:
      return String(value)
    default:
      return escapeText(String(value))
  }
}

function decodeValue(cell, type) {
  if (Object.prototype.toString.call(cell) === '[object Date]') return cell.toISOString()
  if (cell === '' || cell === null || cell === undefined) {
    if (type === T.JSON) return []
    if (type === T.BOOLEAN) return false
    if (type === T.NUMBER) return null
    return ''
  }
  switch (type) {
    case T.NUMBER: {
      const n = Number(cell)
      return Number.isFinite(n) ? n : null
    }
    case T.BOOLEAN:
      return cell === true || String(cell).toUpperCase() === 'TRUE'
    case T.JSON:
      try {
        return JSON.parse(String(cell))
      } catch {
        return []
      }
    default:
      return String(cell)
  }
}

function columnsOf(tableName) {
  const columns = TABLES[tableName]
  if (!columns) throw new Error(`Unknown table: ${tableName}`)
  return columns
}

/** An object → one row of cells, in the order of `headers` (the Sheet's first row). */
export function encodeRow(tableName, headers, obj) {
  const types = Object.fromEntries(columnsOf(tableName).map((c) => [c.name, c.type]))
  return headers.map((h) => (h in types ? encodeValue(obj[h], types[h]) : ''))
}

/** One row of cells → an object with only the table's known columns. */
export function decodeRow(tableName, headers, row) {
  const obj = {}
  for (const { name, type } of columnsOf(tableName)) {
    const i = headers.indexOf(name)
    obj[name] = decodeValue(i === -1 ? '' : row[i], type)
  }
  return obj
}
