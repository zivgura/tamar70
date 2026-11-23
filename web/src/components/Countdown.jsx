import { useEffect, useState } from 'react'
import { useLang } from '../i18n/i18n.js'
import { countdownParts } from '../lib/format.js'
import styles from './Countdown.module.css'

/** Days, hours and minutes until `target`. Renders nothing once it has passed. */
export function Countdown({ target }) {
  const { t } = useLang()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const parts = countdownParts(target, now)
  if (!parts) return null
  const units = [
    [t('countdown.days'), parts.days],
    [t('countdown.hours'), parts.hours],
    [t('countdown.minutes'), parts.minutes],
  ]
  return (
    <dl className={styles.countdown} aria-label={t('countdown.label')}>
      {units.map(([label, value]) => (
        <div key={label} className={styles.unit}>
          <dt className={styles.label}>{label}</dt>
          <dd className={styles.value}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
