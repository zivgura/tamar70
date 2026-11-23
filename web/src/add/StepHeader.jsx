import { Link } from 'react-router-dom'
import { ChevronBackIcon, CloseIcon } from '../components/icons.js'
import styles from './Add.module.css'
import { useLang } from '../i18n/i18n.js'

const STEPS = 3

/** Close (step 1) or back (later steps), "step N of 3", and the three bars. */
export function StepHeader({ step, onBack }) {
  const { t } = useLang()
  return (
    <>
      <div className={styles.stepHeader}>
        {step === 1 ? (
          <Link to="/" className={styles.iconButton} aria-label={t('common.close')}>
            <CloseIcon />
          </Link>
        ) : (
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('common.back')}
            onClick={onBack}
          >
            <ChevronBackIcon />
          </button>
        )}
        <span className={styles.stepCount}>{t('add.step', { step, total: STEPS })}</span>
      </div>
      <div className={styles.bars} aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <div key={i} className={`${styles.bar} ${i < step ? styles.barDone : ''}`} />
        ))}
      </div>
    </>
  )
}
