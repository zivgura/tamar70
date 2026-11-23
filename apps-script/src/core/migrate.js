import {
  CATEGORY_TONES,
  DEFAULT_TONE,
  MERGED_CATEGORIES,
  SCHEMA_VERSION,
  SETTING_KEYS,
  TABLES,
} from '@tamar70/shared'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './seed.js'
import { readSettings } from './settings.js'

// Version 1 seeded category colors as hex values. The design system names them instead.
const V1_HEX_TONES = { '#d4a5a0': 'rose', '#9caf88': 'sage', '#c0745a': 'terracotta' }
const SEEDED_TONE = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, c.color]))

/**
 * Data changes for an existing Sheet, keyed by the version they bring it to. They run once,
 * in order, for every version between the Sheet's and SCHEMA_VERSION. A fresh Sheet is
 * seeded in the newest shape, so these are no-ops there.
 */
// Version 3: wording that sounded like a memorial ("זיכרון", "שלא תשכחו") and the
// renamed protest corner. Seeded texts still worded the old way get the new wording; texts
// edited in the Sheet are left alone.
const V3_WORDING = [
  {
    id: 'journey',
    field: 'description',
    from: 'ילדות, נעורים, רגעים משמעותיים וזיכרונות משפחתיים',
    to: 'ילדות, נעורים, רגעים משמעותיים וסיפורים משפחתיים',
  },
  {
    id: 'journey',
    field: 'prompt_hint',
    from: 'ספרו על רגע מחייה של תמר שלא תשכחו',
    to: 'ספרו על חוויה משותפת מהעבר',
  },
  { id: 'protest', field: 'name', from: 'תקופת המחאה', to: 'מחאות פוליטיות' },
  {
    id: 'protest',
    field: 'description',
    from: 'סיפורים, חוויות ואנשים מתקופת המחאה',
    to: 'סיפורים, חוויות ואנשים מהמחאות שתמר השתתפה בהן',
  },
  {
    id: 'protest',
    field: 'prompt_hint',
    from: 'איפה הייתם עם תמר בתקופת המחאה?',
    to: 'באיזו מחאה הייתם יחד עם תמר?',
  },
  {
    id: 'general',
    field: 'prompt_hint',
    from: 'שתפו כל זיכרון, סיפור או תמונה',
    to: 'שתפו כל סיפור, משפט או תמונה',
  },
]

// Version 9: a new "תרבות" corner, and "עובדה מעניינת על תמר" merged into "לא ידעתם על
// תמר" under a name that covers both. The merged corner's row stays, hidden (active = false),
// and its stories move. Texts edited in the Sheet are left alone; the order follows the seed.
const V9_DID_YOU_KNOW = [
  { field: 'name', from: 'לא ידעתם על תמר' },
  { field: 'description', from: 'כישרונות חבויים, הרגלים, אנקדוטות וסודות משעשעים' },
]

function upgradeTo9(db) {
  const seeded = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.id, c]))
  const rows = () => db.all('Categories')

  if (!rows().some((c) => c.id === 'culture')) db.insert('Categories', seeded.culture)

  const didYouKnow = rows().find((c) => c.id === 'did-you-know')
  if (didYouKnow) {
    for (const { field, from } of V9_DID_YOU_KNOW) {
      if (didYouKnow[field] === from) {
        db.update('Categories', 'id', 'did-you-know', { [field]: seeded['did-you-know'][field] })
      }
    }
  }

  for (const [oldId, newId] of Object.entries(MERGED_CATEGORIES)) {
    if (rows().some((c) => c.id === oldId)) db.update('Categories', 'id', oldId, { active: false })
    for (const story of db.all('Stories').filter((s) => s.category_id === oldId)) {
      db.update('Stories', 'id', story.id, { category_id: newId })
    }
  }

  for (const row of rows()) {
    if (seeded[row.id]) db.update('Categories', 'id', row.id, { order: seeded[row.id].order })
  }
}

const UPGRADES = {
  2(db) {
    for (const category of db.all('Categories')) {
      const color = String(category.color || '').trim()
      if (CATEGORY_TONES.includes(color)) continue
      const tone = SEEDED_TONE[category.id] ?? V1_HEX_TONES[color.toLowerCase()] ?? DEFAULT_TONE
      db.update('Categories', 'id', category.id, { color: tone })
    }
  },
  3(db) {
    for (const { id, field, from, to } of V3_WORDING) {
      const category = db.all('Categories').find((c) => c.id === id)
      if (category && category[field] === from) db.update('Categories', 'id', id, { [field]: to })
    }
  },
  9: upgradeTo9,
}

// The housekeeping job (new-story emails, cleanup) runs on a timer. Installing it here means a
// deploy sets it up by itself; setup() tries again if this ever fails.
function ensureSchedule(ctx) {
  try {
    ctx.schedule?.ensure()
  } catch (err) {
    ctx.log.error(`Could not install the housekeeping timer: ${err && err.message}`)
  }
}

/**
 * Brings the Sheet up to SCHEMA_VERSION: creates missing tabs and columns, seeds empty tabs,
 * then runs the data upgrades the Sheet hasn't had yet. Safe to run any number of times.
 * Runs automatically on the first request after a deploy that bumped the version, so no one
 * has to run anything by hand.
 */
export function migrate(ctx) {
  const { db, schemaVersion, now } = ctx
  if (schemaVersion.get() >= SCHEMA_VERSION) return false

  return ctx.lock.run(() => {
    const from = schemaVersion.get()
    if (from >= SCHEMA_VERSION) return false // another request got here first

    for (const [name, columns] of Object.entries(TABLES)) {
      db.ensureTable(
        name,
        columns.map((c) => c.name),
      )
    }

    if (db.all('Categories').length === 0) {
      for (const c of DEFAULT_CATEGORIES) db.insert('Categories', c)
    }

    const owner = ctx.ownerEmail()
    const existing = readSettings(db)
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (key in existing) continue
      const seeded = key === SETTING_KEYS.NOTIFY_EMAILS ? owner : value
      db.insert('Settings', { key, value: seeded })
    }

    if (db.all('AdminUsers').length === 0 && owner) {
      db.insert('AdminUsers', { email: owner, name: 'Owner', added_at: now() })
    }

    for (let version = Math.max(from, 1) + 1; version <= SCHEMA_VERSION; version++) {
      UPGRADES[version]?.(db)
    }

    schemaVersion.set(SCHEMA_VERSION)
    ensureSchedule(ctx)
    return true
  })
}
