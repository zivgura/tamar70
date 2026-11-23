import styles from './Polaroid.module.css'

const TILTS = {
  none: '',
  left: styles.left,
  right: styles.right,
  leftStrong: styles.leftStrong,
  rightStrong: styles.rightStrong,
}

/**
 * A photo in a polaroid frame. Without `src` it shows the striped placeholder.
 * tilt: none | left | right | leftStrong | rightStrong. `handwritten` uses the hand font
 * for the caption; `taped` adds washi tape. `priority` loads the photo right away (for a
 * photo at the top of the page) instead of when it scrolls into view.
 */
export function Polaroid({
  src,
  srcSet,
  sizes,
  priority = false,
  alt = '',
  caption,
  tilt = 'none',
  taped = false,
  handwritten = false,
  className = '',
}) {
  const classes = [styles.polaroid, TILTS[tilt] ?? '', taped ? styles.taped : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <figure className={classes}>
      {src ? (
        <img
          className={styles.photo}
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
        />
      ) : (
        <div
          className={styles.photo}
          role={alt ? 'img' : undefined}
          aria-label={alt || undefined}
        />
      )}
      {caption && (
        <figcaption className={`${styles.caption} ${handwritten ? styles.hand : ''}`}>
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
