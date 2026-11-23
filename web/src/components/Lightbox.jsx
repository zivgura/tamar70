import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronBackIcon, ChevronForwardIcon, CloseIcon } from './icons.js'
import styles from './Lightbox.module.css'
import { useLang } from '../i18n/i18n.js'

function details(photo, t) {
  return [
    photo.year_approx,
    photo.place,
    photo.people?.length ? t('lightbox.with', { people: photo.people.join(', ') }) : '',
  ].filter(Boolean)
}

/**
 * A photo full screen, with its caption and arrows to the next and previous ones.
 * `index` null means closed. Photos may carry story_id / story_title to link back.
 */
export function Lightbox({ photos, index, onIndex, onClose }) {
  const { lang, t } = useLang()
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
    // In Hebrew (right to left) the next photo is to the left; in English, to the right.
    const forward = lang === 'en' ? 'ArrowRight' : 'ArrowLeft'
    const backward = lang === 'en' ? 'ArrowLeft' : 'ArrowRight'
    if (e.key === forward) go(1)
    if (e.key === backward) go(-1)
  }

  const photo = open ? photos[index] : null
  return (
    <dialog
      ref={ref}
      className={styles.lightbox}
      aria-label={t('lightbox.label')}
      onClose={onClose}
      onKeyDown={onKeyDown}
    >
      {photo && (
        <div className={styles.frame}>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
          <img
            className={styles.image}
            src={photo.url}
            alt={photo.caption || t('lightbox.label')}
          />
          <div className={styles.text}>
            {photo.caption && (
              <p className={styles.caption} dir="auto">
                {photo.caption}
              </p>
            )}
            {details(photo, t).length > 0 && (
              <p className={styles.details}>{details(photo, t).join(' · ')}</p>
            )}
            {photo.story_id && (
              <Link to={`/story/${photo.story_id}`} className={styles.storyLink} onClick={onClose}>
                {t('common.toStory')}
                {photo.story_title && (
                  <>
                    : <bdi>{photo.story_title}</bdi>
                  </>
                )}
              </Link>
            )}
          </div>
          {photos.length > 1 && (
            <div className={styles.nav}>
              <button type="button" onClick={() => go(-1)} aria-label={t('lightbox.prev')}>
                <ChevronBackIcon />
              </button>
              <span className={styles.count}>
                {t('lightbox.position', { n: index + 1, total: photos.length })}
              </span>
              <button type="button" onClick={() => go(1)} aria-label={t('lightbox.next')}>
                <ChevronForwardIcon />
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
