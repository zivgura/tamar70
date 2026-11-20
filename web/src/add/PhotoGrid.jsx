import { MAX_PHOTOS_PER_STORY } from '@tamar70/shared'
import { errorMessage } from '../api/messages.js'
import { ProgressBar } from '../components'
import { PlusIcon } from '../components/icons.js'
import styles from './Add.module.css'

const STAGE_TEXT = {
  queued: 'ממתינה',
  starting: 'מתחילה…',
  uploading: 'מעלה…',
  confirming: 'מאמתת…',
  retrying: 'מנסה שוב…',
  done: 'הועלתה',
  error: 'לא הועלתה',
}

function PhotoNote({ photo }) {
  if (photo.rejected) {
    return <span className={`${styles.photoNote} ${styles.photoNoteError}`}>{photo.rejected}</span>
  }
  if (!photo.stage) {
    const details = [photo.caption, photo.year].filter(Boolean).join(' · ')
    return <span className={styles.photoNote}>{details || 'לחצו להוספת פרטים'}</span>
  }
  const cls = [
    styles.photoNote,
    photo.stage === 'done' ? styles.photoNoteDone : '',
    photo.stage === 'error' ? styles.photoNoteError : '',
  ].join(' ')
  return (
    <span className={cls}>
      {photo.stage === 'error' ? errorMessage(photo.error) : STAGE_TEXT[photo.stage]}
      {photo.stage === 'uploading' && ` ${Math.round((photo.progress ?? 0) * 100)}%`}
    </span>
  )
}

/**
 * The chosen photos as thumbnails. While editing, tapping one opens its details; while
 * sending, each shows its own progress bar.
 */
export function PhotoGrid({ photos, onAdd, onOpen, sending = false }) {
  const room = MAX_PHOTOS_PER_STORY - photos.length
  return (
    <div className={styles.photos}>
      {photos.map((photo) => (
        <div key={photo.key} className={styles.photo}>
          <button
            type="button"
            className={styles.photoButton}
            onClick={() => onOpen?.(photo)}
            disabled={sending}
            aria-label={`פרטי התמונה ${photo.file.name}`}
          >
            <img className={styles.thumb} src={photo.url} alt="" />
          </button>
          {photo.stage && (
            <ProgressBar
              value={photo.progress ?? 0}
              label={photo.file.name}
              state={photo.stage === 'done' ? 'done' : photo.stage === 'error' ? 'error' : 'active'}
            />
          )}
          <PhotoNote photo={photo} />
        </div>
      ))}
      {!sending && room > 0 && (
        <label className={styles.addPhoto}>
          <PlusIcon aria-hidden="true" />
          הוסיפו תמונות
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
