import { boolean, object, string } from 'zod'

// What the site reports about itself: errors on people's phones, and one "visit" per device
// per day. Kept in the Sheet (ClientErrors, Visits); no outside services. The device id is a
// random value made on the device, not tied to a person.
const deviceId = string().regex(/^[A-Za-z0-9_-]{8,64}$/)
const short = (max) => string().trim().max(max)

export const clientErrorSchema = object({
  message: short(500).min(1),
  stack: short(4000).optional().default(''),
  path: short(300).optional().default(''),
  release: short(64).optional().default(''),
  user_agent: short(300).optional().default(''),
  device: deviceId.optional(),
})

export const clientVisitSchema = object({
  device: deviceId,
  path: short(300).optional().default(''),
  has_code: boolean().optional().default(false),
  first_visit: boolean().optional().default(false),
})

export const TELEMETRY_LIMITS = Object.freeze({
  // Same error from anywhere is saved once per window; the rest only bump its count.
  ERROR_DEDUPE_SECONDS: 600,
  // Above this many new errors an hour, more are dropped (a broken release can't flood the Sheet).
  ERRORS_PER_HOUR: 60,
  VISITS_PER_HOUR: 500,
})
