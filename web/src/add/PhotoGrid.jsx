import { MAX_PHOTOS_PER_STORY } from '@tamar70/shared'
import { errorMessage, rejectMessage } from '../api/messages.js'
import { ProgressBar } from '../components'
import { PlusIcon } from '../components/icons.js'
import styles from './Add.module.css'
import { useLang } from '../i18n/i18n.js'

// Each upload stage's text is the dictionary key photo.<stage>.
function PhotoNote({ photo, sending }) {
  const { lang, t } = useLang()
  if (photo.rejected) {
    return (
      <span className={`${styles.photoNote} ${styles.photoNoteError}`}>
        {rejectMessage(photo.rejected, lang)}
      </span>
    )
  }
  if (!photo.stage && sending) {
    return <span className={styles.photoNote}>{t('photo.queued')}</span>
  }
  if (!photo.stage) {
    const details = [photo.caption, photo.year].filter(Boolean).join(' · ')
    return <span className={styles.photoNote}>{details || t('photo.addDetails')}</span>
  }
  const cls = [
    styles.photoNote,
    photo.stage === 'done' ? styles.photoNoteDone : '',
    photo.stage === 'error' ? styles.photoNoteError : '',
  ].join(' ')
  return (
    <span className={cls}>
      {photo.stage === 'error' ? errorMessage(photo.error, lang) : t(`photo.${photo.stage}`)}
      {photo.stage === 'uploading' && ` ${Math.round((photo.progress ?? 0) * 100)}%`}
    </span>
  )
}

/**
 * The chosen photos as thumbnails. While editing, tapping one opens its details; while
 * sending, each shows its own progress bar.
 */
export function PhotoGrid({ photos, onAdd, onOpen, sending = false }) {
  const { t } = useLang()
  const room = MAX_PHOTOS_PER_STORY - photos.length
  // Each photo: { key, name, url, caption?, year?, ... }; `url` may be missing for a photo
  // Drive couldn't make a thumbnail for.
  return (
    <div className={styles.photos}>
      {photos.map((photo) => (
        <div key={photo.key} className={styles.photo}>
          <button
            type="button"
            className={styles.photoButton}
            onClick={() => onOpen?.(photo)}
            disabled={sending}
            aria-label={t('photo.detailsOf', { name: photo.name })}
          >
            {photo.url ? (
              <img className={styles.thumb} src={photo.url} alt="" />
            ) : (
              <span className={styles.thumb} />
            )}
          </button>
          {photo.stage && (
            <ProgressBar
              value={photo.progress ?? 0}
              label={photo.name}
              state={photo.stage === 'done' ? 'done' : photo.stage === 'error' ? 'error' : 'active'}
            />
          )}
          <PhotoNote photo={photo} sending={sending} />
        </div>
      ))}
      {!sending && room > 0 && (
        <label className={styles.addPhoto}>
          <PlusIcon aria-hidden="true" />
          {t('photo.add')}
          <input
            className="visually-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              onAdd(Array.from(e.target.files).slice(0, room))
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
