import { SCHEMA_VERSION, SETTING_KEYS, TABLES } from '@tamar70/shared'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './seed.js'
import { readSettings } from './settings.js'

/**
 * Brings the Sheet up to SCHEMA_VERSION: creates missing tabs and columns, then seeds
 * empty tabs. Safe to run any number of times. Runs automatically on the first request after
 * a deploy that bumped the version, so no one has to run anything by hand.
 */
export function migrate(ctx) {
  const { db, schemaVersion, now } = ctx
  if (schemaVersion.get() >= SCHEMA_VERSION) return false

  return ctx.lock.run(() => {
    if (schemaVersion.get() >= SCHEMA_VERSION) return false // another request got here first

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

    schemaVersion.set(SCHEMA_VERSION)
    return true
  })
}
