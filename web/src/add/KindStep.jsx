import { STORY_KIND } from '@tamar70/shared'
import { useId } from 'react'
import { PencilIcon, PencilPhotoIcon, PhotoIcon } from '../components/icons.js'
import styles from './Add.module.css'

const KINDS = [
  {
    kind: STORY_KIND.TEXT,
    title: 'כתיבה',
    hint: 'סיפור, משפט או ברכה',
    Icon: PencilIcon,
    tone: 'rose',
  },
  {
    kind: STORY_KIND.PHOTOS,
    title: 'תמונות',
    hint: 'תמונה אחת או כמה, בלי לכתוב',
    Icon: PhotoIcon,
    tone: 'sage',
  },
  {
    kind: STORY_KIND.MIXED,
    title: 'כתיבה ותמונות',
    hint: 'סיפור עם התמונות שלו',
    Icon: PencilPhotoIcon,
    tone: 'terracotta',
  },
]

/** Step 1: what would you like to share? */
export function KindStep({ kind, onChange }) {
  const id = useId()
  return (
    <>
      <h1 className={styles.title}>מה תרצו לשתף?</h1>
      <p className={styles.lead}>אין תשובה לא נכונה. אפשר תמיד להוסיף עוד סיפור אחר כך.</p>
      <div className={styles.tiles} role="group" aria-label="סוג השיתוף">
        {KINDS.map(({ kind: value, title, hint, Icon, tone }) => (
          <button
            key={value}
            type="button"
            className={styles.tile}
            aria-pressed={kind === value}
            onClick={() => onChange(value)}
            data-tone={tone}
            aria-labelledby={`${id}-${value}-title`}
            aria-describedby={`${id}-${value}-hint`}
          >
            <span className={styles.tileIcon} aria-hidden="true">
              <Icon />
            </span>
            <span className={styles.tileText}>
              <span id={`${id}-${value}-title`} className={styles.tileTitle}>
                {title}
              </span>
              <span id={`${id}-${value}-hint`} className={styles.tileHint}>
                {hint}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
