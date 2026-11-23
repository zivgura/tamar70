import { STORY_KIND } from '@tamar70/shared'
import { useId } from 'react'
import { PencilIcon, PencilPhotoIcon, PhotoIcon } from '../components/icons.js'
import styles from './Add.module.css'
import { useLang } from '../i18n/i18n.js'

// title and hint are dictionary keys.
const KINDS = [
  {
    kind: STORY_KIND.TEXT,
    title: 'kind.text',
    hint: 'kind.textHint',
    Icon: PencilIcon,
    tone: 'rose',
  },
  {
    kind: STORY_KIND.PHOTOS,
    title: 'kind.photos',
    hint: 'kind.photosHint',
    Icon: PhotoIcon,
    tone: 'sage',
  },
  {
    kind: STORY_KIND.MIXED,
    title: 'kind.mixed',
    hint: 'kind.mixedHint',
    Icon: PencilPhotoIcon,
    tone: 'terracotta',
  },
]

/** Step 1: what would you like to share? */
export function KindStep({ kind, onChange }) {
  const { t } = useLang()
  const id = useId()
  return (
    <>
      <h1 className={styles.title}>{t('kind.title')}</h1>
      <p className={styles.lead}>{t('kind.lead')}</p>
      <div className={styles.tiles} role="group" aria-label={t('kind.group')}>
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
                {t(title)}
              </span>
              <span id={`${id}-${value}-hint`} className={styles.tileHint}>
                {t(hint)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
