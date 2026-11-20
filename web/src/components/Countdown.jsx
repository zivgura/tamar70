import { useEffect, useState } from 'react'
import { countdownParts } from '../lib/format.js'
import styles from './Countdown.module.css'

/** Days, hours and minutes until `target`. Renders nothing once it has passed. */
export function Countdown({ target }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const parts = countdownParts(target, now)
  if (!parts) return null
  const units = [
    ['ימים', parts.days],
    ['שעות', parts.hours],
    ['דקות', parts.minutes],
  ]
  return (
    <dl className={styles.countdown} aria-label="הזמן שנשאר עד יום ההולדת">
      {units.map(([label, value]) => (
        <div key={label} className={styles.unit}>
          <dt className={styles.label}>{label}</dt>
          <dd className={styles.value}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
