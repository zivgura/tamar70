import styles from './Admin.module.css'
import { storyState } from './adminFormat.js'

/** "מוסתר" / "נמחק" next to a story that isn't on the site. Nothing for a shown one. */
export function StateBadge({ story }) {
  const state = storyState(story)
  if (state === 'shown') return null
  return (
    <span className={styles.badge} data-state={state}>
      {{ hidden: 'מוסתר', deleted: 'נמחק', early: 'פתוח מוקדם' }[state]}
    </span>
  )
}
