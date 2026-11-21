import { useState } from 'react'
import { Lightbox } from './Lightbox.jsx'
import styles from './PhotoMosaic.module.css'

/** Photos as a grid of thumbnails; tapping one opens it full screen. */
export function PhotoMosaic({ photos, label = 'תמונות' }) {
  const [index, setIndex] = useState(null)
  if (!photos?.length) return null
  return (
    <>
      <ul className={styles.mosaic} aria-label={label}>
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              className={styles.tile}
              onClick={() => setIndex(i)}
              aria-label={p.caption ? `הגדלת התמונה: ${p.caption}` : `הגדלת תמונה ${i + 1}`}
            >
              <img className={styles.thumb} src={p.thumb} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox photos={photos} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
    </>
  )
}
