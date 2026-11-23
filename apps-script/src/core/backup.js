// Backups and export. Once a week (and on demand) the whole Sheet is copied into the Backups
// folder in Drive; the newest copies are kept. The export hands admins everything collected,
// for files they keep themselves.
import {
  CATEGORY_TONES,
  DEFAULT_TONE,
  isPhotoMedia,
  photoUrl,
  SETTING_KEYS,
  STORY_STATUS,
  UPLOAD_STATUS,
} from '@tamar70/shared'
import { readSettings, writeSetting } from './settings.js'
import { israelDay } from './telemetry.js'

export const BACKUP_EVERY_MS = 7 * 24 * 60 * 60 * 1000
export const BACKUPS_KEPT = 10

const ms = (iso) => Date.parse(iso) || 0

// Wide enough for a full A4 page at print quality, small enough to load quickly.
const BOOK_PHOTO_WIDTH = 2000

/** Copies the Sheet now and trims old copies. */
export function backupNow(ctx) {
  const now = ctx.now()
  const copy = ctx.backups.copySheet(`גיבוי תמר בת 70 ${israelDay(now)}`)
  const old = ctx.backups
    .list()
    .sort((a, b) => ms(b.created) - ms(a.created))
    .slice(BACKUPS_KEPT)
  for (const f of old) {
    try {
      ctx.backups.trash(f.id)
    } catch (err) {
      ctx.log.error(`Could not trash old backup ${f.id}: ${err && err.message}`)
    }
  }
  writeSetting(ctx.db, SETTING_KEYS.BACKED_UP_AT, now)
  return { backed_up_at: now, url: copy.url }
}

/** Run by the timer: a copy when the last one is a week old. */
export function weeklyBackup(ctx) {
  const last = readSettings(ctx.db)[SETTING_KEYS.BACKED_UP_AT]
  if (last && ms(ctx.now()) - ms(last) < BACKUP_EVERY_MS) return null
  return backupNow(ctx)
}

export function backupStatus(ctx) {
  let folderUrl = null
  try {
    folderUrl = ctx.backups.folderUrl()
  } catch (err) {
    ctx.log.error(`Backups folder: ${err && err.message}`)
  }
  return {
    backed_up_at: readSettings(ctx.db)[SETTING_KEYS.BACKED_UP_AT] || null,
    folder_url: folderUrl,
  }
}

/** Every story that wasn't deleted, with its photos' details and Drive links. */
export function exportAll(ctx) {
  const categoryRows = ctx.db.all('Categories').filter((c) => c.id)
  const names = Object.fromEntries(categoryRows.map((c) => [c.id, c.name]))
  const photos = new Map()
  for (const m of ctx.db.all('Media')) {
    if (m.upload_status !== UPLOAD_STATUS.DONE || !m.drive_file_id || !isPhotoMedia(m)) continue
    if (!photos.has(m.story_id)) photos.set(m.story_id, [])
    photos.get(m.story_id).push(m)
  }
  const stories = ctx.db
    .all('Stories')
    .filter((s) => s.id && s.status !== STORY_STATUS.DELETED)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((s) => ({
      id: s.id,
      created_at: s.created_at,
      author_name: s.author_name,
      author_relation: s.author_relation,
      corner: names[s.category_id] ?? 'כללי',
      category_id: s.category_id,
      title: s.title,
      content: s.content,
      decade: s.decade,
      places: s.places ?? [],
      people: s.people ?? [],
      visibility: s.visibility,
      admin_notes: s.admin_notes,
      photos: (photos.get(s.id) ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((m) => ({
          filename: m.filename,
          caption: m.caption,
          year_approx: m.year_approx,
          people: m.people ?? [],
          place: m.place,
          link: `https://drive.google.com/file/d/${m.drive_file_id}/view`,
          // A picture for the printable book, where the photo is open to view (shared).
          image: m.is_shared ? photoUrl(m.drive_file_id, BOOK_PHOTO_WIDTH) : null,
        })),
    }))
  // The corners in their order, for the book's chapters.
  const categories = categoryRows
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      tone: CATEGORY_TONES.includes(c.color) ? c.color : DEFAULT_TONE,
    }))
  return { exported_at: ctx.now(), stories, categories }
}
