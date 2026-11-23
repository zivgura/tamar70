// Counts and dates in the site's language (Hebrew unless `lang` says 'en'). The words live in
// the i18n dictionaries.
import { translate } from '../i18n/i18n.js'

const LOCALES = { he: 'he-IL', en: 'en-GB' }
const locale = (lang) => LOCALES[lang] ?? LOCALES.he

export const storiesText = (n, lang = 'he') => translate(lang, 'count.stories', { n })
export const peopleText = (n, lang = 'he') => translate(lang, 'count.people', { n })
export const photosText = (n, lang = 'he') => translate(lang, 'count.photos', { n })
export const attachedPhotosText = (n, lang = 'he') => translate(lang, 'count.attachedPhotos', { n })

const TIME_ZONE = 'Asia/Jerusalem'

/** "7 בפברואר" (or "7 February") from "2027-02-07". */
export function formatDay(isoDate, lang = 'he') {
  if (!isoDate) return ''
  const date = new Date(`${String(isoDate).slice(0, 10)}T12:00:00Z`)
  return new Intl.DateTimeFormat(locale(lang), {
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

const UNITS = [
  ['year', 365 * 86_400],
  ['month', 30 * 86_400],
  ['week', 7 * 86_400],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

/** "לפני יומיים", "אתמול", "לפני 5 דקות" (or "2 days ago", "yesterday"). */
export function timeAgo(iso, now = new Date(), lang = 'he') {
  const relative = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' })
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const seconds = Math.round((then.getTime() - now.getTime()) / 1000)
  for (const [unit, size] of UNITS) {
    // Chrome writes dual forms with the number too ("לפני שבועיים (2)"); drop it.
    if (Math.abs(seconds) >= size) {
      return relative.format(Math.round(seconds / size), unit).replace(/\s*\(\d+\)$/, '')
    }
  }
  return translate(lang, 'time.now')
}

/** Formats a date in Israel time, e.g. for "נכתב ב-3 בדצמבר". */
export function formatDate(iso, lang = 'he') {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale(lang), {
    day: 'numeric',
    month: 'long',
    timeZone: TIME_ZONE,
  }).format(date)
}
