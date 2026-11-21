import { googleDocId, LIMITS } from '@tamar70/shared'
import { useRef, useState } from 'react'
import { api } from '../api/client.js'
import { errorMessage } from '../api/messages.js'
import { isDocx, readDocx } from '../lib/readDocx.js'
import styles from './Add.module.css'

const TOO_LONG = `המסמך ארוך מדי: אפשר עד ${LIMITS.STORY_CONTENT_MAX.toLocaleString('en-US')} תווים.`

/**
 * "Already wrote it?": a Word file or a Google Docs link. The text goes into the story box,
 * for the person to check before sending. A Word file itself goes to `onDocument`, to be kept
 * with the story.
 */
export function DocumentImport({ content, onText, onDocument }) {
  const inputRef = useRef(null)
  const [link, setLink] = useState('')
  const [state, setState] = useState({ status: 'idle' }) // idle | reading | done | error
  const reading = state.status === 'reading'

  /** Adds the text below what's already typed. False (with a message) if it can't. */
  function applyText(text, source) {
    if (!text) {
      setState({ status: 'error', message: 'לא מצאנו טקסט במסמך הזה.' })
      return false
    }
    const joined = content.trim() ? `${content.trim()}\n\n${text}` : text
    if (joined.length > LIMITS.STORY_CONTENT_MAX) {
      setState({ status: 'error', message: TOO_LONG })
      return false
    }
    onText(joined)
    setState({ status: 'done', source })
    return true
  }

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!isDocx(file)) {
      setState({ status: 'error', message: 'אפשר להעלות רק מסמך Word (קובץ docx).' })
      return
    }
    setState({ status: 'reading' })
    try {
      if (applyText(await readDocx(file), `מ-${file.name}`)) onDocument?.(file)
    } catch {
      setState({ status: 'error', message: 'לא הצלחנו לקרוא את המסמך. נסו לשמור אותו שוב כ-docx.' })
    }
  }

  async function importLink(e) {
    e.preventDefault()
    if (!googleDocId(link)) {
      setState({ status: 'error', message: 'זה לא קישור למסמך Google Docs.' })
      return
    }
    setState({ status: 'reading' })
    try {
      const { text } = await api.importGoogleDoc(link.trim())
      if (applyText(text, 'מהמסמך ב-Google Docs')) setLink('')
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err) })
    }
  }

  return (
    <div className={styles.docImport}>
      <p className={styles.docTitle}>כבר כתבתם את הסיפור?</p>
      <p className={styles.docHint}>
        העלו מסמך Word או הדביקו קישור ל-Google Docs, והטקסט ייכנס לסיפור.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="visually-hidden"
        tabIndex={-1}
        onChange={pick}
        aria-label="בחירת מסמך Word"
      />
      <button
        type="button"
        className={styles.docButton}
        onClick={() => inputRef.current?.click()}
        disabled={reading}
      >
        העלאת מסמך Word
      </button>

      {/* A div, not a form: this sits inside the story form. Enter imports. */}
      <div className={styles.docLink}>
        <label htmlFor="google-doc-link" className={styles.docHint}>
          או קישור ל-Google Docs:
        </label>
        <div className={styles.docLinkRow}>
          <input
            id="google-doc-link"
            type="url"
            inputMode="url"
            dir="ltr"
            className={styles.docLinkInput}
            placeholder="https://docs.google.com/document/d/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && importLink(e)}
            disabled={reading}
          />
          <button
            type="button"
            className={styles.docButton}
            onClick={importLink}
            disabled={reading || !link.trim()}
          >
            ייבוא
          </button>
        </div>
        <p className={styles.docSmall}>
          המסמך צריך להיות משותף: בגוגל דוקס, שיתוף ← &quot;כל מי שיש לו את הקישור&quot;.
        </p>
      </div>

      <p className={styles.docStatus} aria-live="polite">
        {reading && 'קוראים את המסמך…'}
        {state.status === 'done' && (
          <>
            הטקסט <bdi>{state.source}</bdi> נכנס לסיפור. עברו עליו לפני השליחה.
          </>
        )}
        {state.status === 'error' && <span className={styles.docError}>{state.message}</span>}
      </p>
    </div>
  )
}
