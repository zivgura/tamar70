import { Button } from '../components'
import styles from './Admin.module.css'

/** A confirm step before something that can't be undone. Open it with ref.current.showModal(). */
export function ConfirmDialog({ ref, title, confirmLabel, onConfirm, children, danger = true }) {
  const close = () => ref.current?.close?.()
  return (
    <dialog ref={ref} className={styles.dialog} aria-label={title}>
      <div className={styles.dialogBody}>
        <h2 className={styles.dialogTitle}>{title}</h2>
        <p className={styles.dialogText}>{children}</p>
        <div className={styles.dialogActions}>
          <Button
            className={danger ? styles.dangerFill : undefined}
            onClick={() => {
              close()
              onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="quiet" onClick={close}>
            ביטול
          </Button>
        </div>
      </div>
    </dialog>
  )
}
