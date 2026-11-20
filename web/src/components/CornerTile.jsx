import { Link } from 'react-router-dom'
import styles from './CornerTile.module.css'

/** A corner as a postcard with a stamp in its tone. `wide` spans both grid columns. */
export function CornerTile({ category, wide = false }) {
  return (
    <Link
      to={`/corner/${category.id}`}
      className={`${styles.tile} ${wide ? styles.wide : ''}`}
      data-tone={category.tone}
    >
      <span className={styles.stamp} aria-hidden="true" />
      <span className={styles.name}>{category.name}</span>
    </Link>
  )
}
