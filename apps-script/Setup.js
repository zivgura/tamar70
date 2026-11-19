// One-time setup. Run `setup` once from the Apps Script editor.
// Safe to run again: it reuses anything that already exists.
function setup() {
  const props = PropertiesService.getScriptProperties()

  const root = getOrCreateFolder_(DriveApp.getRootFolder(), 'Tamar70')
  const originals = getOrCreateFolder_(root, 'originals')
  const backups = getOrCreateFolder_(root, 'backups')

  let sheetId = props.getProperty('SHEET_ID')
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

  props.setProperties({
    ROOT_FOLDER_ID: root.getId(),
    ORIGINALS_FOLDER_ID: originals.getId(),
    BACKUPS_FOLDER_ID: backups.getId(),
    SHEET_ID: sheetId,
  })
  // Display sizes come from Drive's thumbnail URL, so no separate folder is needed.
  props.deleteProperty('DISPLAY_FOLDER_ID')

  Logger.log('Done. Folder: ' + root.getUrl())
  Logger.log('Sheet: https://docs.google.com/spreadsheets/d/' + sheetId)
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : parent.createFolder(name)
}
