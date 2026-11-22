import { ACTIONS, JOB_KIND, JOB_STATUS } from '@tamar70/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { errorMessage } from '../api/messages.js'
import { Button, CardsSkeleton, ErrorMessage, Spinner } from '../components'
import styles from './Admin.module.css'
import { useAdmin } from './adminContext.js'
import { formatDateTime } from './adminFormat.js'
import { useAdminGame } from './adminQueries.js'

const JOB_LABELS = { [JOB_KIND.CHECK]: 'בדיקת חיבור' }
const STATUS_LABELS = {
  [JOB_STATUS.QUEUED]: 'ממתינה',
  [JOB_STATUS.RUNNING]: 'רצה',
  [JOB_STATUS.DONE]: 'הסתיימה',
  [JOB_STATUS.FAILED]: 'נכשלה',
}
const MODEL_HINTS = {
  'claude-opus-5-5': 'מומלץ: הכי טוב בעברית ובחידות. המשחק כולו בערך 4 עד 5 דולר.',
  'claude-sonnet-5-5': 'חצי מחיר, קצת פחות מדויק. המשחק כולו בערך 2 דולר.',
}

/** "$0.0060" for small sums, "$1.25" for bigger ones. */
function formatUsd(usd) {
  const n = Number(usd) || 0
  return `$${n < 0.1 ? n.toFixed(4) : n.toFixed(2)}`
}

/** A dollar amount that keeps its order inside Hebrew text. */
function Usd({ value }) {
  return <bdi dir="ltr">{formatUsd(value)}</bdi>
}

const isOpen = (job) => job.status === JOB_STATUS.QUEUED || job.status === JOB_STATUS.RUNNING

/** How to add the Claude API key, for an admin who hasn't yet. */
function KeySteps() {
  return (
    <ol className={styles.steps}>
      <li>
        היכנסו לקונסולה של Claude (
        <a href="https://platform.claude.com" target="_blank" rel="noreferrer">
          platform.claude.com
        </a>
        ), טענו קרדיט (10 דולר מספיקים בשפע) והגדירו תקרת הוצאה חודשית.
      </li>
      <li>צרו מפתח API חדש והעתיקו אותו.</li>
      <li>
        בעורך Apps Script: הגדרות הפרויקט ← מאפייני סקריפט ← הוספת מאפיין. שם המאפיין:{' '}
        <code dir="ltr">CLAUDE_API_KEY</code>, והערך: המפתח.
      </li>
      <li>חזרו לכאן ולחצו &quot;בדיקת החיבור&quot;.</li>
    </ol>
  )
}

function ConnectionSection({ data, onStatus }) {
  const { call } = useAdmin()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const lastCheck = data.jobs.find((j) => j.kind === JOB_KIND.CHECK)
  const checking = Boolean(lastCheck && isOpen(lastCheck))

  async function check() {
    setBusy(true)
    setError(null)
    try {
      onStatus(await call(ACTIONS.ADMIN_GAME_JOB_START, { kind: JOB_KIND.CHECK }))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>החיבור ל-Claude</h2>
      {data.ai_configured ? (
        <p>
          <strong>יש מפתח API.</strong> העובדות והחידות ייכתבו עם Claude, ברקע, רק כשתלחצו על כפתור.
          אפשר לבדוק שהחיבור עובד:
        </p>
      ) : (
        <>
          <p className={styles.error}>עוד אין מפתח API, ולכן אי אפשר לכתוב עובדות וחידות.</p>
          <KeySteps />
        </>
      )}
      <Button variant="secondary" onClick={check} disabled={busy || checking}>
        בדיקת החיבור
      </Button>
      <div className={styles.statusSlot} aria-live="polite">
        {(busy || checking) && <Spinner label="בודקים" size="small" />}
        {(busy || checking) && <span>שולחים ל-Claude בקשה קטנה…</span>}
        {!busy && !checking && lastCheck?.status === JOB_STATUS.DONE && (
          <span>
            החיבור עובד. Claude ענה: &quot;{lastCheck.progress?.reply}&quot;. העלות:{' '}
            <Usd value={lastCheck.cost_usd} />
          </span>
        )}
        {!busy && !checking && lastCheck?.status === JOB_STATUS.FAILED && (
          <span className={styles.error} role="alert">
            הבדיקה נכשלה: {lastCheck.error}
          </span>
        )}
        {error && (
          <span className={styles.error} role="alert">
            {errorMessage(error)}
          </span>
        )}
      </div>
    </section>
  )
}

function ModelSection({ data, onStatus }) {
  const { call } = useAdmin()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function choose(model) {
    setSaving(true)
    setError(null)
    try {
      onStatus(await call(ACTIONS.ADMIN_GAME_CONFIG, { model }))
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>המודל</h2>
      <fieldset className={styles.fieldset} disabled={saving}>
        <legend className={styles.visuallyHidden}>איזה מודל של Claude</legend>
        <div className={styles.options}>
          {data.models.map((m) => (
            <div key={m.id} className={styles.option}>
              <input
                id={`model-${m.id}`}
                type="radio"
                name="model"
                value={m.id}
                checked={data.model === m.id}
                onChange={() => choose(m.id)}
                className={styles.radio}
              />
              <label htmlFor={`model-${m.id}`} className={styles.optionText}>
                <span className={styles.optionLabel}>
                  <bdi>{m.label}</bdi>
                </span>
                <span className={styles.rowMeta}>{MODEL_HINTS[m.id]}</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <div className={styles.statusSlot} aria-live="polite">
        {saving && <Spinner label="שומרים" size="small" />}
        {error && (
          <span className={styles.error} role="alert">
            {errorMessage(error)}
          </span>
        )}
      </div>
    </section>
  )
}

function JobsSection({ jobs }) {
  const total = jobs.reduce((sum, j) => sum + (Number(j.cost_usd) || 0), 0)
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>עבודות אחרונות</h2>
      {jobs.length === 0 ? (
        <p className={styles.meta}>עוד לא רצה אף עבודה.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {jobs.map((job) => (
              <li key={job.id} className={styles.errorRow}>
                <div className={styles.rowTop}>
                  <span className={styles.rowTitle}>{JOB_LABELS[job.kind] ?? job.kind}</span>
                  <span className={styles.badge} data-state={`job-${job.status}`}>
                    {STATUS_LABELS[job.status] ?? job.status}
                  </span>
                </div>
                <span className={styles.rowMeta}>
                  {formatDateTime(job.created_at)}
                  {job.status === JOB_STATUS.DONE || job.status === JOB_STATUS.FAILED ? ' · ' : ''}
                  {(job.status === JOB_STATUS.DONE || job.status === JOB_STATUS.FAILED) && (
                    <Usd value={job.cost_usd} />
                  )}
                </span>
                {job.error && <span className={styles.error}>{job.error}</span>}
              </li>
            ))}
          </ul>
          <p className={styles.meta}>
            עלות כל העבודות ברשימה: <Usd value={total} />
          </p>
        </>
      )}
    </section>
  )
}

/** /admin/game: the escape room. For now: the Claude connection, the model and the jobs. */
export default function AdminGame() {
  const queryClient = useQueryClient()
  const { data, isPending, error, refetch } = useAdminGame()
  if (isPending) return <CardsSkeleton count={3} />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const setStatus = (next) => queryClient.setQueriesData({ queryKey: ['admin', 'game'] }, next)
  const { counts } = data

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>חדר בריחה</h1>
      <p className={styles.lead}>
        כאן ייבנה משחק הבריחה של תמר מתוך הסיפורים: Claude מוצא עובדות, כותב חידות, ואתן בוחרות
        ומאשרות. כל חידה מפנה לסיפור או לתמונה שהיא מבוססת עליהם.
      </p>

      <ConnectionSection data={data} onStatus={setStatus} />
      <ModelSection data={data} onStatus={setStatus} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>מה יש עד עכשיו</h2>
        <dl className={styles.totals}>
          <div>
            <dt>עובדות (נשמרו)</dt>
            <dd>
              {counts.facts} <span className={styles.rowMeta}>({counts.facts_kept})</span>
            </dd>
          </div>
          <div>
            <dt>חידות (אושרו)</dt>
            <dd>
              {counts.puzzles} <span className={styles.rowMeta}>({counts.puzzles_approved})</span>
            </dd>
          </div>
        </dl>
        <p className={styles.meta}>מציאת העובדות וכתיבת החידות יתווספו לכאן בשלבים הבאים.</p>
      </section>

      <JobsSection jobs={data.jobs} />
    </div>
  )
}
