import styles from './ProgressBar.module.css'

const STATES = { active: '', done: styles.done, error: styles.error }

/**
 * A thin progress bar. `value` is 0..1. state: active (terracotta) | done (sage) | error.
 * `label` names it for screen readers (e.g. the file name).
 */
export function ProgressBar({ value = 0, state = 'active', label, className = '' }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      className={[styles.track, STATES[state] ?? '', className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className={styles.fill} style={{ width: `${state === 'error' ? 100 : percent}%` }} />
    </div>
  )
}
