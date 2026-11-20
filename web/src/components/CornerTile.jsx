import { Link } from 'react-router-dom'
import { CornerIcon } from './CornerIcon.jsx'
import styles from './CornerTile.module.css'

/** A corner as a postcard: a stamp with its icon in its tone. `wide` spans both columns. */
export function CornerTile({ category, wide = false }) {
  return (
    <Link
      to={`/corner/${category.id}`}
      className={`${styles.tile} ${wide ? styles.wide : ''}`}
      data-tone={category.tone}
    >
      <span className={styles.stamp}>
        <CornerIcon id={category.id} size={26} />
      </span>
      <span className={styles.name}>{category.name}</span>
    </Link>
  )
}
