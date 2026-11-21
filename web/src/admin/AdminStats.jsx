import { ErrorMessage, CardsSkeleton } from '../components'
import styles from './Admin.module.css'
import { formatDateTime } from './adminFormat.js'
import { useAdminStats } from './adminQueries.js'

/** "1.12" from "2026-12-01". */
const shortDay = (date) => {
  const [, month, day] = date.split('-')
  return `${Number(day)}.${Number(month)}`
}

/** /admin/stats: who's been visiting, what came in, and what broke. */
export default function AdminStats() {
  const { data, isPending, error, refetch } = useAdminStats()
  if (isPending) return <CardsSkeleton count={3} />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const { days, totals, errors } = data
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>נתונים</h1>
      <dl className={styles.totals}>
        <div>
          <dt>מכשירים שנכנסו</dt>
          <dd>{totals.devices}</dd>
        </div>
        <div>
          <dt>סיפורים</dt>
          <dd>{days.reduce((n, d) => n + d.stories, 0)}</dd>
        </div>
      </dl>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>לפי יום</h2>
        {days.length === 0 ? (
          <p className={styles.meta}>עוד אין נתונים.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">יום</th>
                <th scope="col">מכשירים</th>
                <th scope="col">חדשים</th>
                <th scope="col">סיפורים</th>
                <th scope="col">תמונות</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <th scope="row">{shortDay(d.date)}</th>
                  <td>{d.devices}</td>
                  <td>{d.new_devices}</td>
                  <td>{d.stories}</td>
                  <td>{d.photos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>תקלות אצל אנשים ({errors.length})</h2>
        {errors.length === 0 ? (
          <p className={styles.meta}>לא נרשמו תקלות.</p>
        ) : (
          <ul className={styles.list}>
            {errors.map((e) => (
              <li key={e.id} className={styles.errorRow}>
                <span className={styles.rowTitle} dir="ltr">
                  {e.message}
                </span>
                <span className={styles.rowMeta}>
                  {formatDateTime(e.last_seen || e.ts)}
                  {e.count > 1 ? ` · ${e.count} פעמים` : ''} · <bdi>{e.path}</bdi> · גרסה{' '}
                  <bdi>{e.release}</bdi>
                </span>
                <details>
                  <summary className={styles.rowMeta}>פרטים</summary>
                  <pre className={styles.stack} dir="ltr">
                    {e.user_agent}
                    {'\n\n'}
                    {e.stack}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
