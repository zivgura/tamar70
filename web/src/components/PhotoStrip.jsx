import { useRef, useState } from 'react'
import { useLang } from '../i18n/i18n.js'
import { ChevronBackIcon, ChevronForwardIcon } from './icons.js'
import { Lightbox } from './Lightbox.jsx'
import styles from './PhotoStrip.module.css'

/**
 * A row of photos to swipe sideways, polaroid style; tapping one opens it full screen.
 * Light on purpose: small thumbnails, loaded only as they scroll into view, and the
 * browser's own scrolling (no carousel library, no timers).
 */
export function PhotoStrip({ photos, label }) {
  const { t } = useLang()
  const listRef = useRef(null)
  const [index, setIndex] = useState(null)
  if (!photos?.length) return null

  // Arrows for a mouse: one screen's worth along the reading direction.
  const scroll = (step) => {
    const list = listRef.current
    if (!list) return
    const rtl = getComputedStyle(list).direction === 'rtl'
    list.scrollBy({ left: step * list.clientWidth * 0.8 * (rtl ? -1 : 1), behavior: 'smooth' })
  }

  return (
    <div className={styles.strip}>
      <ul ref={listRef} className={styles.list} aria-label={label}>
        {photos.map((p, i) => (
          <li key={p.id} className={styles.item}>
            <button
              type="button"
              className={styles.frame}
              onClick={() => setIndex(i)}
              aria-label={
                p.caption
                  ? t('photos.enlarge', { caption: p.caption })
                  : t('photos.enlargeN', { n: i + 1 })
              }
            >
              <img
                className={styles.photo}
                src={p.thumb}
                alt=""
                loading="lazy"
                decoding="async"
                width="300"
                height="300"
              />
              {/* Always there, so frames with and without a caption are the same height. A plain
                  space collapses to nothing, so an empty caption holds a non-breaking one. */}
              <span className={styles.caption} dir="auto">
                {p.caption || '\u00A0'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`${styles.arrow} ${styles.back}`}
        onClick={() => scroll(-1)}
        aria-label={t('lightbox.prev')}
      >
        <ChevronBackIcon />
      </button>
      <button
        type="button"
        className={`${styles.arrow} ${styles.forward}`}
        onClick={() => scroll(1)}
        aria-label={t('lightbox.next')}
      >
        <ChevronForwardIcon />
      </button>
      <Lightbox photos={photos} index={index} onIndex={setIndex} onClose={() => setIndex(null)} />
    </div>
  )
}
