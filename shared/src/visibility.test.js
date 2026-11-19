import { describe, expect, it } from 'vitest'
import { SITE_STATUS, STORY_STATUS, VISIBILITY } from './constants.js'
import { getStoryView, STORY_VIEW } from './visibility.js'

const story = (overrides = {}) => ({
  status: STORY_STATUS.ACTIVE,
  visibility: VISIBILITY.DEFAULT,
  ...overrides,
})

describe('getStoryView', () => {
  it('shows a teaser while collecting', () => {
    expect(getStoryView(story(), SITE_STATUS.COLLECTING)).toBe(STORY_VIEW.TEASER)
  })

  it('shows the full story once published', () => {
    expect(getStoryView(story(), SITE_STATUS.PUBLISHED)).toBe(STORY_VIEW.FULL)
  })

  it('reveals an early story while collecting', () => {
    const early = story({ visibility: VISIBILITY.EARLY })
    expect(getStoryView(early, SITE_STATUS.COLLECTING)).toBe(STORY_VIEW.FULL)
  })

  it.each([SITE_STATUS.COLLECTING, SITE_STATUS.PUBLISHED])('hides a hidden story (%s)', (site) => {
    expect(getStoryView(story({ visibility: VISIBILITY.HIDDEN }), site)).toBe(STORY_VIEW.NONE)
  })

  it.each([VISIBILITY.DEFAULT, VISIBILITY.EARLY])('never shows a deleted story (%s)', (vis) => {
    const deleted = story({ status: STORY_STATUS.DELETED, visibility: vis })
    expect(getStoryView(deleted, SITE_STATUS.PUBLISHED)).toBe(STORY_VIEW.NONE)
  })

  it('shows nothing for an unknown site status', () => {
    expect(getStoryView(story(), 'bogus')).toBe(STORY_VIEW.NONE)
  })
})
