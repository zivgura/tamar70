import { Link } from 'react-router-dom'
import { ChevronBackIcon, CloseIcon } from '../components/icons.js'
import styles from './Add.module.css'

const STEPS = 3

/** Close (step 1) or back (later steps), "step N of 3", and the three bars. */
export function StepHeader({ step, onBack }) {
  return (
    <>
      <div className={styles.stepHeader}>
        {step === 1 ? (
          <Link to="/" className={styles.iconButton} aria-label="סגירה">
            <CloseIcon />
          </Link>
        ) : (
          <button type="button" className={styles.iconButton} aria-label="חזרה" onClick={onBack}>
            <ChevronBackIcon />
          </button>
        )}
        <span className={styles.stepCount}>
          שלב {step} מתוך {STEPS}
        </span>
      </div>
      <div className={styles.bars} aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <div key={i} className={`${styles.bar} ${i < step ? styles.barDone : ''}`} />
        ))}
      </div>
    </>
  )
}
