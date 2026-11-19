import { SITE_STATUS, STORY_STATUS, VISIBILITY } from './constants.js'

export const STORY_VIEW = Object.freeze({
  FULL: 'full',
  TEASER: 'teaser',
  NONE: 'none',
})

/**
 * How a story may be shown to the public. Computed on the server only;
 * the client never receives fields it isn't allowed to show.
 *
 * - Full: active, and either the site is published and visibility isn't hidden,
 *   or visibility is early.
 * - Teaser: the site is collecting, the story is active and visibility isn't hidden.
 * - Otherwise: not shown at all.
 */
export function getStoryView(story, siteStatus) {
  if (story.status !== STORY_STATUS.ACTIVE) return STORY_VIEW.NONE
  if (story.visibility === VISIBILITY.HIDDEN) return STORY_VIEW.NONE
  if (story.visibility === VISIBILITY.EARLY) return STORY_VIEW.FULL
  if (siteStatus === SITE_STATUS.PUBLISHED) return STORY_VIEW.FULL
  if (siteStatus === SITE_STATUS.COLLECTING) return STORY_VIEW.TEASER
  return STORY_VIEW.NONE
}
