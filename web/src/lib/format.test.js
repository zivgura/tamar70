import { describe, expect, it } from 'vitest'
import {
  attachedPhotosText,
  birthdayStart,
  countdownParts,
  formatDay,
  storiesText,
  peopleText,
  timeAgo,
} from './format.js'

describe('Hebrew counts', () => {
  it('uses the singular form for one', () => {
    expect(storiesText(1)).toBe('סיפור אחד')
    expect(peopleText(1)).toBe('אדם אחד')
    expect(attachedPhotosText(1)).toBe('תמונה אחת מצורפת')
  })

  it('uses digits and the plural otherwise', () => {
    expect(storiesText(47)).toBe('47 סיפורים')
    expect(peopleText(23)).toBe('23 אנשים')
    expect(attachedPhotosText(3)).toBe('3 תמונות מצורפות')
    expect(storiesText(1200)).toBe('1,200 סיפורים')
  })
})

describe('dates', () => {
  it('formats the birthday as a Hebrew day and month', () => {
    expect(formatDay('2027-02-07')).toBe('7 בפברואר')
  })

  it('counts down to midnight of the birthday in Israel', () => {
    const target = birthdayStart('2027-02-07')
    expect(target.toISOString()).toBe('2027-02-06T22:00:00.000Z')
    expect(countdownParts(target, new Date('2027-02-05T20:30:00Z'))).toEqual({
      days: 1,
      hours: 1,
      minutes: 30,
    })
    expect(countdownParts(target, new Date('2027-02-07T08:00:00Z'))).toBeNull()
  })

  it('says how long ago something was written', () => {
    const now = new Date('2026-12-03T10:00:00Z')
    expect(timeAgo('2026-12-01T10:00:00Z', now)).toBe('שלשום')
    expect(timeAgo('2026-12-03T09:55:00Z', now)).toBe('לפני 5 דקות')
    expect(timeAgo('2026-12-03T09:59:50Z', now)).toBe('עכשיו')
    expect(timeAgo('not a date', now)).toBe('')
  })
})
