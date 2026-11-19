import { SETTING_KEYS } from '@tamar70/shared'
import { writeSetting } from './settings.js'

// No 0/o, 1/l/i: the code is read off WhatsApp links and sometimes typed by hand.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const LENGTH = 8

export const SITE_URL = 'https://tamar70.web.app'

/**
 * Creates a new family code and stores only its hash. The old link stops working for new
 * submissions right away. Returns the new code and the link to share.
 */
export function rotateFamilyCode(ctx) {
  const bytes = ctx.crypto.randomBytes(LENGTH)
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
  writeSetting(ctx.db, SETTING_KEYS.FAMILY_CODE_HASH, ctx.crypto.sha256(code))
  return { code, link: `${SITE_URL}/?k=${code}` }
}
