import { ACTIONS, DIGEST_HOUR, NOTIFY_MODE, SITE_STATUS } from '@tamar70/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { errorMessage } from '../api/messages.js'
import { Button, ErrorMessage, LoadingCards, Spinner } from '../components'
import styles from './Admin.module.css'
import { useAdmin } from './adminContext.js'
import { formatDateTime } from './adminFormat.js'
import { useAdminSettings } from './adminQueries.js'
import { ConfirmDialog } from './ConfirmDialog.jsx'

const MODES = [
  {
    id: NOTIFY_MODE.EACH,
    label: 'על כל סיפור',
    hint: 'מייל לכל סיפור חדש, כמה דקות אחרי שנשלח.',
  },
  {
    id: NOTIFY_MODE.DAILY,
    label: 'סיכום יומי',
    hint: `מייל אחד בערב, אחרי ${DIGEST_HOUR}:00, עם כל הסיפורים של היום. בלי מייל ביום בלי סיפורים.`,
  },
  { id: NOTIFY_MODE.OFF, label: 'בלי מיילים', hint: 'אפשר לראות הכל כאן, בדף הסיפורים.' },
]

// The timer runs every 15 minutes; much longer than that means it stopped.
const TIMER_LATE_MS = 40 * 60 * 1000

/** The reveal button and its undo, with how far the photos are from being open. */
function RevealSection({ settings, onChange }) {
  const { call } = useAdmin()
  const confirmRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const published = settings.site_status === SITE_STATUS.PUBLISHED
  const { shared, total, to_close: toClose } = settings.sharing

  async function change(siteStatus) {
    setBusy(true)
    setError(null)
    try {
      onChange(await call(ACTIONS.ADMIN_SITE_STATUS, { site_status: siteStatus }))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>חשיפת הסיפורים</h2>
      {published ? (
        <p>
          <strong>האתר פורסם.</strong> כל הסיפורים פתוחים לקריאה.{' '}
          {total > 0 &&
            (shared < total
              ? `נפתחו ${shared} מתוך ${total} תמונות; השאר ייפתחו תוך רבע שעה.`
              : `כל ${total} התמונות פתוחות לצפייה.`)}
        </p>
      ) : (
        <p>
          <strong>שלב האיסוף.</strong> באתר רואים רק את תחילת כל סיפור, והתמונות פרטיות.
          {toClose > 0 && ` ${toClose} תמונות עוד נסגרות, תוך רבע שעה.`}
        </p>
      )}
      <Button
        block
        variant={published ? 'secondary' : 'primary'}
        disabled={busy}
        onClick={() => confirmRef.current?.showModal?.()}
      >
        {published ? 'החזרה לשלב האיסוף' : 'פרסם את כל הסיפורים'}
      </Button>
      <div className={styles.statusSlot} aria-live="polite">
        {busy && <Spinner label={published ? 'סוגרים' : 'מפרסמים'} size="small" />}
        {busy && <span>{published ? 'סוגרים…' : 'מפרסמים ופותחים את התמונות…'}</span>}
        {error && (
          <span className={styles.error} role="alert">
            {errorMessage(error)}
          </span>
        )}
      </div>
      <ConfirmDialog
        ref={confirmRef}
        title={published ? 'לחזור לשלב האיסוף?' : 'לפרסם את כל הסיפורים?'}
        confirmLabel={published ? 'חזרה לאיסוף' : 'פרסום'}
        danger={false}
        onConfirm={() => change(published ? SITE_STATUS.COLLECTING : SITE_STATUS.PUBLISHED)}
      >
        {published
          ? 'הסיפורים יחזרו להיות טיזרים, התמונות ייסגרו, והכותבים יוכלו שוב לערוך את הסיפורים שלהם.'
          : 'כל הסיפורים והתמונות ייפתחו לכל מי שיש לו את כתובת האתר, והכותבים כבר לא יוכלו לערוך. אפשר לחזור לשלב האיסוף אם צריך.'}
      </ConfirmDialog>
    </section>
  )
}

/** /admin/settings: the reveal, and how admins hear about new stories. */
export default function AdminSettings() {
  const { call } = useAdmin()
  const queryClient = useQueryClient()
  const { data, isPending, error, refetch, dataUpdatedAt } = useAdminSettings()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [test, setTest] = useState({ state: 'idle' }) // idle | sending | sent | failed

  if (isPending) return <LoadingCards count={2} />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  async function changeMode(mode) {
    setSaving(true)
    setSaveError(null)
    try {
      const next = await call(ACTIONS.ADMIN_SETTINGS_UPDATE, { notify_mode: mode })
      queryClient.setQueriesData({ queryKey: ['admin', 'settings'] }, next)
    } catch (err) {
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    setTest({ state: 'sending' })
    try {
      const result = await call(ACTIONS.ADMIN_TEST_EMAIL)
      setTest({ state: result.sent ? 'sent' : 'none', recipients: result.recipients })
    } catch (err) {
      setTest({ state: 'failed', error: err })
    }
  }

  const ranAt = data.housekeeping_ran_at
  // Measured against when this page loaded the settings.
  const timerLate = !ranAt || dataUpdatedAt - Date.parse(ranAt) > TIMER_LATE_MS

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>הגדרות</h1>

      <RevealSection
        settings={data}
        onChange={(next) => {
          queryClient.setQueriesData({ queryKey: ['admin', 'settings'] }, next)
          queryClient.invalidateQueries({ queryKey: ['admin', 'stories'] })
          queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
        }}
      />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>מיילים על סיפורים חדשים</h2>
        <fieldset className={styles.fieldset} disabled={saving}>
          <legend className={styles.visuallyHidden}>כל כמה זמן לשלוח</legend>
          <div className={styles.options}>
            {MODES.map((m) => (
              <div key={m.id} className={styles.option}>
                <input
                  id={`notify-${m.id}`}
                  type="radio"
                  name="notify_mode"
                  value={m.id}
                  checked={data.notify_mode === m.id}
                  onChange={() => changeMode(m.id)}
                  className={styles.radio}
                />
                <label htmlFor={`notify-${m.id}`} className={styles.optionText}>
                  <span className={styles.optionLabel}>{m.label}</span>
                  <span className={styles.rowMeta}>{m.hint}</span>
                </label>
              </div>
            ))}
          </div>
        </fieldset>
        <div className={styles.statusSlot} aria-live="polite">
          {saving && <Spinner label="שומרים" size="small" />}
          {saveError && (
            <span className={styles.error} role="alert">
              {errorMessage(saveError)}
            </span>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>נשלחים אל</h2>
        {data.recipients.length ? (
          <ul className={styles.recipients}>
            {data.recipients.map((r) => (
              <li key={r}>
                <bdi>{r}</bdi>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.error}>אין כתובות. בלי כתובת, מיילים לא יישלחו.</p>
        )}
        <p className={styles.rowMeta}>
          כדי לשנות, ערכו בגיליון את השורה notify_emails בלשונית Settings (כמה כתובות מופרדות
          בפסיק). אם היא ריקה, המיילים נשלחים לכל המנהלות.
        </p>
        <Button
          variant="secondary"
          onClick={sendTest}
          disabled={test.state === 'sending' || data.recipients.length === 0}
        >
          שליחת מייל בדיקה
        </Button>
        <div className={styles.statusSlot} aria-live="polite">
          {test.state === 'sending' && <Spinner label="שולחים" size="small" />}
          {test.state === 'sent' && (
            <span>
              נשלח אל <bdi>{test.recipients.join(', ')}</bdi>. אם לא הגיע תוך כמה דקות, בדקו גם
              בספאם.
            </span>
          )}
          {test.state === 'failed' && (
            <span className={styles.error} role="alert">
              השליחה נכשלה: {errorMessage(test.error)}
            </span>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>הבדיקה האוטומטית</h2>
        <p className={timerLate ? styles.error : styles.meta}>
          {ranAt ? `רצה לאחרונה ב-${formatDateTime(ranAt)}.` : 'עוד לא רצה מאז העדכון האחרון.'}{' '}
          {timerLate
            ? 'היא אמורה לרוץ כל רבע שעה. אם זה נמשך, צריך לבדוק את הטריגרים ב-Apps Script.'
            : 'היא רצה כל רבע שעה, שולחת את המיילים ומנקה העלאות שלא הסתיימו.'}
        </p>
      </section>
    </div>
  )
}
