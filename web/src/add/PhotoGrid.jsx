import { MAX_PHOTOS_PER_STORY } from '@tamar70/shared'
import { errorMessage, rejectMessage } from '../api/messages.js'
import { ProgressBar } from '../components'
import { CheckIcon, PlusIcon } from '../components/icons.js'
import styles from './Add.module.css'
import { useLang } from '../i18n/i18n.js'

/** True once the contributor filled in anything about the photo. */
function hasDetails(photo) {
  return Boolean(photo.caption || photo.year || photo.people)
}

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
  if (!photo.stage) return null // the details button under the thumbnail stands in
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
  const withDetails = photos.filter(hasDetails).length
  return (
    <>
      {!sending && photos.length > 0 && (
        <p className={styles.photoCount} aria-live="polite">
          <CheckIcon aria-hidden="true" />
          {t('photo.countWithDetails', { done: withDetails, total: photos.length })}
        </p>
      )}
      <div className={styles.photos}>
        {photos.map((photo) => (
          <div key={photo.key} className={styles.photo}>
            <button
              type="button"
              className={styles.photoButton}
              onClick={() => onOpen?.(photo)}
              disabled={sending}
              // The details button right below does the same job for keyboards and screen readers.
              tabIndex={-1}
              aria-hidden="true"
            >
              {photo.url ? (
                <img className={styles.thumb} src={photo.url} alt="" />
              ) : (
                <span className={styles.thumb} />
              )}
              {!sending && hasDetails(photo) && (
                <span className={styles.photoCheck} aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </button>
            {!sending && !photo.rejected && (
              <button
                type="button"
                className={styles.photoDetails}
                data-filled={hasDetails(photo) || undefined}
                onClick={() => onOpen?.(photo)}
                aria-label={t('photo.detailsOf', { name: photo.name })}
              >
                {hasDetails(photo) ? (
                  <>
                    <b>{photo.caption || t('photo.noName')}</b>
                    {photo.year && <span>{photo.year}</span>}
                  </>
                ) : (
                  <>
                    <PlusIcon aria-hidden="true" />
                    {t('photo.nameAndYear')}
                  </>
                )}
              </button>
            )}
            {photo.stage && (
              <ProgressBar
                value={photo.progress ?? 0}
                label={photo.name}
                state={
                  photo.stage === 'done' ? 'done' : photo.stage === 'error' ? 'error' : 'active'
                }
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
    </>
  )
}
