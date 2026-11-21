// Runs on a timer (every 15 minutes), never from a visitor's request:
// - emails the admins about new stories (each one, a daily summary, or not at all);
// - once a day, cleans up photo uploads that never finished.
import {
  DIGEST_HOUR,
  NOTIFY_MODE,
  SETTING_KEYS,
  STORY_STATUS,
  UPLOAD_STATUS,
} from '@tamar70/shared'
import { weeklyBackup } from './backup.js'
import { invalidatePublicCache } from './media.js'
import { syncSharing } from './reveal.js'
import { readSettings, writeSetting } from './settings.js'

export const HOUSEKEEPING_MINUTES = 15
const SITE_URL = 'https://tamar70.web.app'
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

const categoryNames = (ctx) =>
  Object.fromEntries(ctx.db.all('Categories').map((c) => [c.id, c.name]))

/** "2026-12-01 20" → day and hour in Israel. */
function israelClock(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) }
}

export function digestEmail(stories, names) {
  const lines = stories.map((s) => {
    const who = s.author_relation ? `${s.author_name} (${s.author_relation})` : s.author_name
    const photos = s.media_count ? ` · ${s.media_count} תמונות` : ''
    return `• ${s.title || s.excerpt || 'בלי כותרת'} — ${who}, ${names[s.category_id] ?? 'כללי'}${photos}\n  ${SITE_URL}/admin/story/${s.id}`
  })
  return {
    subject: stories.length === 1 ? 'סיפור חדש היום' : `${stories.length} סיפורים חדשים היום`,
    body: [...lines, '', `כל הסיפורים: ${SITE_URL}/admin`].join('\n'),
  }
}

/**
 * Tells the admins about stories added since the last time, as Settings.notify_mode says:
 * one email per story, one summary a day after DIGEST_HOUR, or nothing (the starting point
 * still moves on, so turning emails back on doesn't send old stories). Returns emails sent.
 */
export function notifyNewStories(ctx) {
  const settings = readSettings(ctx.db)
  const since = settings[SETTING_KEYS.NOTIFIED_UNTIL]
  const until = ms(ctx.now()) - SETTLE_MS
  if (!since) {
    writeSetting(ctx.db, SETTING_KEYS.NOTIFIED_UNTIL, new Date(until).toISOString())
    return 0
  }
  const mode = settings[SETTING_KEYS.NOTIFY_MODE] || NOTIFY_MODE.EACH
  const clock = israelClock(ctx.now())
  if (mode === NOTIFY_MODE.DAILY) {
    if (clock.hour < DIGEST_HOUR || settings[SETTING_KEYS.DIGEST_SENT_ON] === clock.day) return 0
  }

  const fresh = ctx.db
    .all('Stories')
    .filter((s) => s.status === STORY_STATUS.ACTIVE)
    .filter((s) => ms(s.created_at) > ms(since) && ms(s.created_at) <= until)
    .sort((a, b) => ms(a.created_at) - ms(b.created_at))
  const to = recipients(ctx).join(',')

  if (mode === NOTIFY_MODE.OFF) {
    if (fresh.length)
      writeSetting(ctx.db, SETTING_KEYS.NOTIFIED_UNTIL, fresh[fresh.length - 1].created_at)
    return 0
  }
  if (mode === NOTIFY_MODE.DAILY) {
    writeSetting(ctx.db, SETTING_KEYS.DIGEST_SENT_ON, clock.day)
    if (fresh.length === 0) return 0
    if (to) ctx.mail.send({ to, ...digestEmail(fresh, categoryNames(ctx)) })
    writeSetting(ctx.db, SETTING_KEYS.NOTIFIED_UNTIL, fresh[fresh.length - 1].created_at)
    return to ? 1 : 0
  }

  const names = categoryNames(ctx)
  let sent = 0
  for (const story of fresh.slice(0, MAX_EMAILS_PER_RUN)) {
    if (to) {
      ctx.mail.send({ to, ...storyEmail(story, names[story.category_id] ?? 'כללי') })
      sent++
    }
    // Saved after each email, so a failure halfway doesn't send the earlier ones again.
    writeSetting(ctx.db, SETTING_KEYS.NOTIFIED_UNTIL, story.created_at)
  }
  return sent
}

/** Sent from the admin settings page, to check that emails arrive. */
export function sendTestEmail(ctx, adminEmail) {
  const to = recipients(ctx)
  if (to.length === 0) return { sent: false, recipients: [] }
  ctx.mail.send({
    to: to.join(','),
    subject: 'מייל בדיקה מהאתר של תמר',
    body: [
      'זה מייל בדיקה. אם הוא הגיע, ההתראות על סיפורים חדשים עובדות.',
      '',
      `נשלח לבקשת ${adminEmail}.`,
      `הגדרות: ${SITE_URL}/admin/settings`,
    ].join('\n'),
  })
  return { sent: true, recipients: to }
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
  writeSetting(ctx.db, SETTING_KEYS.HOUSEKEEPING_RAN_AT, ctx.now())
  // Finishes opening (or closing) photos after the reveal button.
  const shared = syncSharing(ctx)
  if (shared) invalidatePublicCache(ctx)
  const emailed = notifyNewStories(ctx)
  try {
    weeklyBackup(ctx)
  } catch (err) {
    ctx.log.error(`Weekly backup failed: ${err && err.message}`)
  }
  const cleaned = cleanUp(ctx)
  ctx.log.info(
    `Housekeeping: ${emailed} emails${cleaned ? `, cleanup ${JSON.stringify(cleaned)}` : ''}`,
  )
  return { emailed, cleaned }
}
