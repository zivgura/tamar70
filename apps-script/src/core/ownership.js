import { ERROR_CODES, SITE_STATUS, STORY_STATUS } from '@tamar70/shared'
import { ApiError } from './errors.js'
import { readSettings, siteConfig } from './settings.js'

/**
 * The contributor's own story, proven by the edit token their device kept. A wrong token and
 * a missing story get the same answer, so the API doesn't reveal which stories exist.
 */
export function ownStory(ctx, storyId, editToken) {
  const hash = ctx.crypto.sha256(editToken)
  const story = ctx.db.all('Stories').find((s) => s.id === storyId)
  if (!story || story.status !== STORY_STATUS.ACTIVE || story.edit_token_hash !== hash) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'Not your story')
  }
  return story
}

/** Contributors may change their stories until the site is published. */
export function requireEditable(ctx) {
  if (siteConfig(readSettings(ctx.db)).site_status !== SITE_STATUS.COLLECTING) {
    throw new ApiError(ERROR_CODES.EDITING_CLOSED, 'Stories can no longer be changed')
  }
}

export function requireSubmissionsOpen(ctx) {
  if (!siteConfig(readSettings(ctx.db)).submissions_open) {
    throw new ApiError(ERROR_CODES.SUBMISSIONS_CLOSED, 'Submissions are closed')
  }
}
