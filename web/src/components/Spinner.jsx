import styles from './Spinner.module.css'

/** A loading spinner. `label` is read out to screen readers; size: default (40px) | small. */
export function Spinner({ label = 'טוען', size = 'default', className = '' }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={[styles.spinner, size === 'small' ? styles.small : '', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
