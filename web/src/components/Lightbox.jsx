import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronBackIcon, ChevronForwardIcon, CloseIcon } from './icons.js'
import styles from './Lightbox.module.css'

function details(photo) {
  return [
    photo.year_approx,
    photo.place,
    photo.people?.length ? `עם ${photo.people.join(', ')}` : '',
  ].filter(Boolean)
}

/**
 * A photo full screen, with its caption and arrows to the next and previous ones.
 * `index` null means closed. Photos may carry story_id / story_title to link back.
 */
export function Lightbox({ photos, index, onIndex, onClose }) {
  const ref = useRef(null)
  const open = index !== null && index !== undefined && photos[index]

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  const go = (step) => onIndex((index + step + photos.length) % photos.length)

  function onKeyDown(e) {
    // In RTL the next photo is to the left.
    if (e.key === 'ArrowLeft') go(1)
    if (e.key === 'ArrowRight') go(-1)
  }

  const photo = open ? photos[index] : null
  return (
    <dialog
      ref={ref}
      className={styles.lightbox}
      aria-label="תמונה"
      onClose={onClose}
      onKeyDown={onKeyDown}
    >
      {photo && (
        <div className={styles.frame}>
          <button type="button" className={styles.close} onClick={onClose} aria-label="סגירה">
            <CloseIcon />
          </button>
          <img className={styles.image} src={photo.url} alt={photo.caption || 'תמונה'} />
          <div className={styles.text}>
            {photo.caption && <p className={styles.caption}>{photo.caption}</p>}
            {details(photo).length > 0 && (
              <p className={styles.details}>{details(photo).join(' · ')}</p>
            )}
            {photo.story_id && (
              <Link to={`/story/${photo.story_id}`} className={styles.storyLink} onClick={onClose}>
                לסיפור{photo.story_title ? `: ${photo.story_title}` : ''}
              </Link>
            )}
          </div>
          {photos.length > 1 && (
            <div className={styles.nav}>
              <button type="button" onClick={() => go(-1)} aria-label="התמונה הקודמת">
                <ChevronBackIcon />
              </button>
              <span className={styles.count}>
                {index + 1} מתוך {photos.length}
              </span>
              <button type="button" onClick={() => go(1)} aria-label="התמונה הבאה">
                <ChevronForwardIcon />
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
