import { errorMessage, rejectMessage } from '../api/messages.js'
import { ProgressBar } from '../components'
import styles from './Add.module.css'
import { useLang } from '../i18n/i18n.js'

// Each upload stage's text is the dictionary key photo.<stage>.
function PhotoNote({ photo }) {
  const { lang, t } = useLang()
  if (photo.rejected) {
    return (
      <span className={`${styles.photoNote} ${styles.photoNoteError}`}>
        {rejectMessage(photo.rejected, lang)}
      </span>
    )
  }
  if (!photo.stage) {
    return <span className={styles.photoNote}>{t('photo.queued')}</span>
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

/** The photos while they are being sent: thumbnails, each with its own progress bar. */
export function PhotoGrid({ photos }) {
  return (
    <div className={styles.photos}>
      {photos.map((photo) => (
        <div key={photo.key} className={styles.photo}>
          <div className={styles.photoButton}>
            {photo.url ? (
              <img className={styles.thumb} src={photo.url} alt="" />
            ) : (
              <span className={styles.thumb} />
            )}
          </div>
          {photo.stage && (
            <ProgressBar
              value={photo.progress ?? 0}
              label={photo.name}
              state={photo.stage === 'done' ? 'done' : photo.stage === 'error' ? 'error' : 'active'}
            />
          )}
          <PhotoNote photo={photo} />
        </div>
      ))}
    </div>
  )
}
