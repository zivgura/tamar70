import { errorMessage } from '../api/messages.js'
import { Button } from './Button.jsx'
import styles from './Status.module.css'

/** A friendly failure message with a retry button. */
export function ErrorMessage({ error, onRetry }) {
  return (
    <div className={styles.message} role="alert">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="quiet" size="small" onClick={onRetry}>
          נסו שוב
        </Button>
      )}
    </div>
  )
}

/** A short centered message (empty states, not found). */
export function Message({ children }) {
  return <div className={styles.message}>{children}</div>
}
