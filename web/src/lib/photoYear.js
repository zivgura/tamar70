// The years a photo can be dated to (the server's limits, shared/src/media.js).
export const PHOTO_YEAR_MIN = 1940
export const PHOTO_YEAR_MAX = 2030

/** The year as a number when it is a valid one, else null. */
export function photoYear(value) {
  const year = Number.parseInt(value, 10)
  return Number.isInteger(year) && year >= PHOTO_YEAR_MIN && year <= PHOTO_YEAR_MAX ? year : null
}

/** A typed year the server would refuse (it is left out when sending), so the form flags it. */
export function isBadYear(value) {
  return Boolean(value) && !(/^\d{4}$/.test(String(value)) && photoYear(value))
}
