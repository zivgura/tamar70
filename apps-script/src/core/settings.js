import { SETTING_KEYS, SITE_STATUS } from '@tamar70/shared'

/** Settings tab → { key: value }. */
export function readSettings(db) {
  const out = {}
  for (const { key, value } of db.all('Settings')) {
    if (key) out[key] = value ?? ''
  }
  return out
}

export function writeSetting(db, key, value) {
  const updated = db.update('Settings', 'key', key, { value })
  if (!updated) db.insert('Settings', { key, value })
}

const isTrue = (v) =>
  String(v ?? '')
    .trim()
    .toUpperCase() === 'TRUE'

/** Typed view of the settings the API cares about. */
export function siteConfig(settings) {
  const status = settings[SETTING_KEYS.SITE_STATUS]
  return {
    site_status: status === SITE_STATUS.PUBLISHED ? SITE_STATUS.PUBLISHED : SITE_STATUS.COLLECTING,
    birthday_date: settings[SETTING_KEYS.BIRTHDAY_DATE] || null,
    submissions_open: isTrue(settings[SETTING_KEYS.SUBMISSIONS_OPEN]),
    comments_open: isTrue(settings[SETTING_KEYS.COMMENTS_OPEN]),
    reveal_message: settings[SETTING_KEYS.REVEAL_MESSAGE] || '',
    family_code_hash: settings[SETTING_KEYS.FAMILY_CODE_HASH] || '',
  }
}
