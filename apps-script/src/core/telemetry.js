// Errors from people's phones and one visit per device per day, saved in the Sheet for the
// admin stats page. Both calls are public, so both are capped: a broken release or a
// misbehaving page can add only so many rows.
import {
  ACTIONS,
  clientErrorSchema,
  clientVisitSchema,
  STORY_STATUS,
  TELEMETRY_LIMITS,
  UPLOAD_STATUS,
} from '@tamar70/shared'

const HOUR_SECONDS = 3600

/** "2026-12-01", the day in Israel. */
export function israelDay(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(iso))
}

/** Counts calls in this hour; false once `limit` is passed. */
export function underHourlyLimit(ctx, name, limit) {
  const hour = String(ctx.now()).slice(0, 13)
  const key = `rate:${name}:${hour}`
  const used = Number(ctx.cache.get(key) ?? 0)
  if (used >= limit) return false
  ctx.cache.put(key, String(used + 1), HOUR_SECONDS)
  return true
}

function logError(ctx, payload) {
  const input = clientErrorSchema.parse(payload)
  const signature = ctx.crypto.sha256(`${input.message}|${input.path}|${input.release}`)
  const seenKey = `err:${signature}`
  const now = ctx.now()

  // Seen recently: bump the count on its row instead of adding another.
  if (ctx.cache.get(seenKey)) {
    ctx.lock.run(() => {
      const row = ctx.db
        .all('ClientErrors')
        .reverse()
        .find(
          (e) =>
            e.message === input.message && e.path === input.path && e.release === input.release,
        )
      if (row) {
        ctx.db.update('ClientErrors', 'id', row.id, { count: (row.count || 1) + 1, last_seen: now })
      }
    })
    return { saved: false }
  }
  if (!underHourlyLimit(ctx, 'errors', TELEMETRY_LIMITS.ERRORS_PER_HOUR)) return { saved: false }

  ctx.cache.put(seenKey, '1', TELEMETRY_LIMITS.ERROR_DEDUPE_SECONDS)
  ctx.lock.run(() =>
    ctx.db.insert('ClientErrors', {
      id: `er_${ctx.crypto.randomId(10)}`,
      ts: now,
      message: input.message,
      path: input.path,
      stack: input.stack,
      release: input.release,
      user_agent: input.user_agent,
      device: input.device ?? '',
      count: 1,
      last_seen: now,
    }),
  )
  return { saved: true }
}

function logVisit(ctx, payload) {
  const input = clientVisitSchema.parse(payload)
  const date = israelDay(ctx.now())
  // The site sends one visit a day per device; this catches repeats from other tabs.
  const key = `visit:${date}:${input.device}`
  if (ctx.cache.get(key)) return { saved: false }
  if (!underHourlyLimit(ctx, 'visits', TELEMETRY_LIMITS.VISITS_PER_HOUR)) return { saved: false }
  ctx.cache.put(key, '1', 6 * HOUR_SECONDS)
  ctx.lock.run(() =>
    ctx.db.insert('Visits', {
      date,
      device: input.device,
      path: input.path,
      first_visit: input.first_visit,
    }),
  )
  return { saved: true }
}

/** Per day: devices, first-time devices, stories and photos. Newest day first. */
export function dailyStats(ctx) {
  const days = new Map()
  const day = (date) => {
    if (!days.has(date)) {
      days.set(date, { date, devices: new Set(), new_devices: 0, stories: 0, photos: 0 })
    }
    return days.get(date)
  }
  for (const v of ctx.db.all('Visits')) {
    if (!v.date) continue
    const d = day(v.date)
    d.devices.add(v.device)
    if (v.first_visit) d.new_devices++
  }
  for (const s of ctx.db.all('Stories')) {
    if (s.created_at && s.status !== STORY_STATUS.DELETED) day(israelDay(s.created_at)).stories++
  }
  for (const m of ctx.db.all('Media')) {
    if (m.uploaded_at && m.upload_status === UPLOAD_STATUS.DONE) {
      day(israelDay(m.uploaded_at)).photos++
    }
  }
  return [...days.values()]
    .map((d) => ({ ...d, devices: d.devices.size }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function stats(ctx) {
  const visits = ctx.db.all('Visits')
  const errors = ctx.db
    .all('ClientErrors')
    .filter((e) => e.ts)
    .sort((a, b) => String(b.last_seen || b.ts).localeCompare(String(a.last_seen || a.ts)))
    .slice(0, 50)
  return {
    days: dailyStats(ctx).slice(0, 60),
    totals: {
      devices: new Set(visits.map((v) => v.device)).size,
    },
    errors,
  }
}

export const telemetryHandlers = {
  [ACTIONS.CLIENT_ERROR]: logError,
  [ACTIONS.CLIENT_VISIT]: logVisit,
}
