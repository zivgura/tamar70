// Entry points. esbuild bundles this file into dist/Code.js; build.js adds top-level
// function declarations that call these, because Apps Script only sees declared functions.
import { SCHEMA_VERSION } from '@tamar70/shared'
import { housekeeping as housekeepingCore } from './core/housekeeping.js'
import { migrate } from './core/migrate.js'
import { handleRequest } from './core/router.js'
import { createContext, props } from './gas/context.js'

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}

/** The JSON API. */
export function doPost(e) {
  let ctx
  try {
    ctx = createContext()
  } catch (err) {
    console.error(err && err.stack ? err.stack : err)
    return json({ ok: false, error: { code: 'internal', message: 'Something went wrong' } })
  }
  return json(handleRequest(e && e.postData ? e.postData.contents : '', ctx))
}

/** Health check: open the web app URL in a browser to see that the deploy is live. */
export function doGet() {
  return json({
    ok: true,
    data: {
      service: 'tamar70',
      schema_version: Number(props().getProperty('SCHEMA_VERSION') || 0),
    },
  })
}

function getOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : parent.createFolder(name)
}

/**
 * One-time setup, run from the editor: creates the Drive folders and the Sheet if they don't
 * exist, then builds all tabs. Safe to run again. Also the way to grant new permissions.
 */
export function setup() {
  const p = props()
  const root = getOrCreateFolder(DriveApp.getRootFolder(), 'Tamar70')
  const originals = getOrCreateFolder(root, 'originals')
  const backups = getOrCreateFolder(root, 'backups')

  let sheetId = p.getProperty('SHEET_ID')
  if (!sheetId) {
    const existing = root.getFilesByName('Tamar70 data')
    if (existing.hasNext()) {
      sheetId = existing.next().getId()
    } else {
      const ss = SpreadsheetApp.create('Tamar70 data')
      DriveApp.getFileById(ss.getId()).moveTo(root)
      sheetId = ss.getId()
    }
  }

  p.setProperties({
    ROOT_FOLDER_ID: root.getId(),
    ORIGINALS_FOLDER_ID: originals.getId(),
    BACKUPS_FOLDER_ID: backups.getId(),
    SHEET_ID: sheetId,
  })
  p.deleteProperty('DISPLAY_FOLDER_ID')

  const ctx = createContext()
  migrate(ctx)
  if (ctx.schedule.ensure()) console.log('Installed the housekeeping timer.')
  console.log(`Done. Schema version ${SCHEMA_VERSION}.`)
  console.log(`Folder: ${root.getUrl()}`)
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}`)
}

/** Run by a timer every 15 minutes: emails about new stories, daily cleanup. */
export function housekeeping() {
  const ctx = createContext()
  migrate(ctx)
  housekeepingCore(ctx)
}
