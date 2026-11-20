import { STORY_STATUS, VISIBILITY } from '@tamar70/shared'

/** shown | hidden | deleted, as admins think of a story. */
export function storyState(story) {
  if (story.status === STORY_STATUS.DELETED) return 'deleted'
  if (story.visibility === VISIBILITY.HIDDEN) return 'hidden'
  return 'shown'
}

/** "1 בדצמבר, 12:00" in Israel time. */
export function formatDateTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  }).format(date)
}

/** "2.4MB" */
export function formatBytes(bytes) {
  if (!bytes) return ''
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
