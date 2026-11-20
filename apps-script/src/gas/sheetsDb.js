import { decodeRow, encodeRow } from '@tamar70/shared'

/**
 * Table storage on the project's Google Sheet: one tab per table, column names in row 1.
 * Rows are found by a key column (stable IDs), never by row number.
 */
export function createSheetsDb(spreadsheetId) {
  let spreadsheet = null
  const ss = () => (spreadsheet ??= SpreadsheetApp.openById(spreadsheetId))

  // One read per tab per request. Writes go straight to the Sheet and drop the copy.
  const memo = new Map()

  function sheetOf(table) {
    const sheet = ss().getSheetByName(table)
    if (!sheet) throw new Error(`Missing tab: ${table}`)
    return sheet
  }

  // Sheets sometimes turns text into a Date (cells typed by hand, or rows written before
  // the column was plain text). Read those back in the Sheet's own time zone, so a date
  // typed as 2027-02-07 stays that day instead of shifting when converted to UTC.
  function fromSheetDate(value) {
    if (Object.prototype.toString.call(value) !== '[object Date]') return value
    const tz = ss().getSpreadsheetTimeZone()
    const isMidnight = Utilities.formatDate(value, tz, 'HH:mm:ss') === '00:00:00'
    return isMidnight ? Utilities.formatDate(value, tz, 'yyyy-MM-dd') : value.toISOString()
  }

  function load(table) {
    if (!memo.has(table)) {
      const values = sheetOf(table).getDataRange().getValues()
      const headers = (values[0] || []).map(String)
      const rows = values.slice(1).map((r) => r.map(fromSheetDate))
      memo.set(table, { headers, rows })
    }
    return memo.get(table)
  }

  // Writes one row as plain text. appendRow would let Sheets turn "2027-02-07" into a date
  // or "1970" into a number regardless of the column's format.
  function writeRow(sheet, rowNumber, cells) {
    sheet.getRange(rowNumber, 1, 1, cells.length).setNumberFormat('@').setValues([cells])
  }

  return {
    all(table) {
      const { headers, rows } = load(table)
      return rows.filter((r) => r.some((c) => c !== '')).map((r) => decodeRow(table, headers, r))
    },

    insert(table, obj) {
      const { headers } = load(table)
      const sheet = sheetOf(table)
      writeRow(sheet, sheet.getLastRow() + 1, encodeRow(table, headers, obj))
      memo.delete(table)
    },

    /** Merges `patch` into the first row whose `keyCol` equals `keyValue`. Returns false if none. */
    update(table, keyCol, keyValue, patch) {
      const { headers, rows } = load(table)
      const k = headers.indexOf(keyCol)
      const i = rows.findIndex((r) => String(r[k]) === String(keyValue))
      if (k === -1 || i === -1) return false
      const merged = { ...decodeRow(table, headers, rows[i]), ...patch }
      writeRow(sheetOf(table), i + 2, encodeRow(table, headers, merged))
      memo.delete(table)
      return true
    },

    /** Creates the tab if needed and appends any missing columns. Never removes or reorders. */
    ensureTable(table, columnNames) {
      let sheet = ss().getSheetByName(table)
      if (!sheet) sheet = ss().insertSheet(table)

      const lastCol = sheet.getLastColumn()
      const current = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : []
      const missing = columnNames.filter((c) => !current.includes(c))
      if (missing.length) {
        sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing])
      }

      const width = current.length + missing.length
      // Plain text everywhere, so Sheets doesn't turn dates, numbers or IDs into something else.
      sheet.getRange(1, 1, sheet.getMaxRows(), width).setNumberFormat('@')
      sheet.getRange(1, 1, 1, width).setFontWeight('bold')
      sheet.setFrozenRows(1)

      // A new spreadsheet starts with one empty tab ("Sheet1", or a localized name).
      // Remove completely empty tabs once a real one exists.
      for (const other of ss().getSheets()) {
        const isBlank = other.getLastRow() === 0 && other.getLastColumn() === 0
        if (isBlank && other.getName() !== table && ss().getSheets().length > 1) {
          ss().deleteSheet(other)
        }
      }
      memo.delete(table)
    },
  }
}
