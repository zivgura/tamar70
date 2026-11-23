import { errorMessage } from '../api/messages.js'
import { Button } from './Button.jsx'
import styles from './Status.module.css'
import { useLang } from '../i18n/i18n.js'

/** A friendly failure message with a retry button. */
export function ErrorMessage({ error, onRetry }) {
  const { lang, t } = useLang()
  return (
    <div className={styles.message} role="alert">
      <p>{errorMessage(error, lang)}</p>
      {onRetry && (
        <Button variant="quiet" size="small" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

/** A short centered message (empty states, not found). */
export function Message({ children }) {
  return <div className={styles.message}>{children}</div>
}
