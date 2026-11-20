// Hebrew wording and dates. Plural forms are spelled out because Hebrew counts differ by
// noun ("סיפור אחד", "שני סיפורים" is not needed here; the site uses digits).

const plural = (one, many) => (n) => (n === 1 ? one : `${n.toLocaleString('he-IL')} ${many}`)

export const storiesText = plural('סיפור אחד', 'סיפורים')
export const peopleText = plural('אדם אחד', 'אנשים')
export const photosText = plural('תמונה אחת', 'תמונות')
export const attachedPhotosText = (n) =>
  n === 1 ? 'תמונה אחת מצורפת' : `${n.toLocaleString('he-IL')} תמונות מצורפות`

const TIME_ZONE = 'Asia/Jerusalem'

/** "7 בפברואר" from "2027-02-07". */
export function formatDay(isoDate) {
  if (!isoDate) return ''
  const date = new Date(`${String(isoDate).slice(0, 10)}T12:00:00Z`)
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date)
}

/** Midnight at the start of the birthday, Israel time (February is always UTC+2). */
export function birthdayStart(isoDate) {
  return isoDate ? new Date(`${String(isoDate).slice(0, 10)}T00:00:00+02:00`) : null
}

/** Days, hours and minutes left until `target`, or null once it has passed. */
export function countdownParts(target, now = new Date()) {
  if (!target) return null
  const ms = target.getTime() - now.getTime()
  if (ms <= 0) return null
  const minutes = Math.floor(ms / 60_000)
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
  }
}

const relative = new Intl.RelativeTimeFormat('he-IL', { numeric: 'auto' })
const UNITS = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** "לפני יומיים", "אתמול", "לפני 5 דקות". */
export function timeAgo(iso, now = new Date()) {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const seconds = Math.round((then.getTime() - now.getTime()) / 1000)
  for (const [unit, size] of UNITS) {
    // Chrome writes dual forms with the number too ("לפני שבועיים (2)"); drop it.
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit).replace(/\s*\(\d+\)$/, '')
    }
  }
  return 'עכשיו'
}

/** Formats a date in Israel time, e.g. for "נכתב ב-3 בדצמבר". */
export function formatDate(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    timeZone: TIME_ZONE,
  }).format(date)
}
