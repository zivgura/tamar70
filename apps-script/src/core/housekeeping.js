// Runs on a timer (every 15 minutes), never from a visitor's request:
// - emails the admins about each new story, so nobody has to watch the Sheet;
// - once a day, cleans up photo uploads that never finished.
import { SETTING_KEYS, STORY_STATUS, UPLOAD_STATUS } from '@tamar70/shared'
import { SITE_URL } from './familyCode.js'
import { readSettings, writeSetting } from './settings.js'

export const HOUSEKEEPING_MINUTES = 15
// A story is announced once its photos have had time to arrive.
const SETTLE_MS = 5 * 60 * 1000
const MAX_EMAILS_PER_RUN = 20
const CLEANUP_EVERY_MS = 20 * 60 * 60 * 1000
// Unfinished uploads older than this are given up on.
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000

const ms = (iso) => Date.parse(iso) || 0
const isAddress = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

/** Settings.notify_emails (comma separated), or every admin if it's empty. */
export function recipients(ctx) {
  const listed = String(readSettings(ctx.db)[SETTING_KEYS.NOTIFY_EMAILS] ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(isAddress)
  const list = listed.length
    ? listed
    : ctx.db
        .all('AdminUsers')
        .map((a) => String(a.email ?? '').trim())
        .filter(isAddress)
  return [...new Set(list.map((s) => s.toLowerCase()))]
}

export function storyEmail(story, categoryName) {
  const heading = story.title || story.excerpt || 'סיפור בלי כותרת'
  const who = story.author_relation
    ? `${story.author_name} (${story.author_relation})`
    : story.author_name
  const photos = story.media_count ? `\nתמונות: ${story.media_count}` : ''
  return {
    subject: `סיפור חדש: ${heading}`.slice(0, 150),
    body: [
      `${who} הוסיפו סיפור לפינה "${categoryName}".`,
      '',
      story.content || '(בלי טקסט)',
      photos,
      '',
      `לצפייה, הסתרה או מחיקה: ${SITE_URL}/admin/story/${story.id}`,
    ].join('\n'),
  }
}

/** One email per story added since the last run. The first run only sets the starting point. */
export function notifyNewStories(ctx) {
  const settings = readSettings(ctx.db)
  const since = settings[SETTING_KEYS.NOTIFIED_UNTIL]
  const until = ms(ctx.now()) - SETTLE_MS
  if (!since) {
    writeSetting(ctx.db, SETTING_KEYS.NOTIFIED_UNTIL, new Date(until).toISOString())
    return 0
  }

  const fresh = ctx.db
    .all('Stories')
    .filter((s) => s.status === STORY_STATUS.ACTIVE)
    .filter((s) => ms(s.created_at) > ms(since) && ms(s.created_at) <= until)
    .sort((a, b) => ms(a.created_at) - ms(b.created_at))
    .slice(0, MAX_EMAILS_PER_RUN)
  if (fresh.length === 0) return 0

  const to = recipients(ctx)
  const names = Object.fromEntries(ctx.db.all('Categories').map((c) => [c.id, c.name]))
  let sent = 0
  for (const story of fresh) {
    if (to.length) {
      ctx.mail.send({ to: to.join(','), ...storyEmail(story, names[story.category_id] ?? 'כללי') })
    }
    sent++
    // Saved after each email, so a failure halfway doesn't send the earlier ones again.
    writeSetting(ctx.db, SETTING_KEYS.NOTIFIED_UNTIL, story.created_at)
  }
  return sent
}

/**
 * Uploads that never finished: their Media rows are marked failed, and files in the originals
 * folder that no photo points to are moved to the Drive trash. Recent ones are left alone,
 * since they may still be on their way.
 */
export function cleanUp(ctx, { force = false } = {}) {
  const now = ms(ctx.now())
  const last = ms(readSettings(ctx.db)[SETTING_KEYS.CLEANED_AT])
  if (!force && now - last < CLEANUP_EVERY_MS) return null

  const media = ctx.db.all('Media')
  const stale = media.filter(
    (m) => m.upload_status === UPLOAD_STATUS.PENDING && now - ms(m.uploaded_at) > STALE_UPLOAD_MS,
  )
  ctx.lock.run(() => {
    for (const m of stale)
      ctx.db.update('Media', 'id', m.id, { upload_status: UPLOAD_STATUS.FAILED })
    writeSetting(ctx.db, SETTING_KEYS.CLEANED_AT, ctx.now())
  })

  const kept = new Set(
    media.filter((m) => m.upload_status === UPLOAD_STATUS.DONE).map((m) => m.drive_file_id),
  )
  let trashed = 0
  for (const file of ctx.drive.listFiles()) {
    if (kept.has(file.id) || now - ms(file.created) < STALE_UPLOAD_MS) continue
    try {
      ctx.drive.trash(file.id)
      trashed++
    } catch (err) {
      ctx.log.error(`Could not trash ${file.id}: ${err && err.message}`)
    }
  }
  return { failed: stale.length, trashed }
}

export function housekeeping(ctx) {
  const emailed = notifyNewStories(ctx)
  const cleaned = cleanUp(ctx)
  ctx.log.info(
    `Housekeeping: ${emailed} emails${cleaned ? `, cleanup ${JSON.stringify(cleaned)}` : ''}`,
  )
  return { emailed, cleaned }
}
