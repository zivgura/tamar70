import styles from './Spinner.module.css'
import { useLang } from '../i18n/i18n.js'

/** A loading spinner. `label` is read out to screen readers; size: default (40px) | small. */
export function Spinner({ label, size = 'default', className = '' }) {
  const { t } = useLang()
  return (
    <span
      role="status"
      aria-label={label ?? t('common.loading')}
      className={[styles.spinner, size === 'small' ? styles.small : '', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
