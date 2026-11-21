import { LIMITS } from '@tamar70/shared'
import { useRef, useState } from 'react'
import { isDocx, readDocx } from '../lib/readDocx.js'
import styles from './Add.module.css'

/**
 * "Already wrote it in Word?": reads the document's text into the story box, for the person
 * to check before sending. The file itself goes to `onDocument` to be kept with the story.
 */
export function DocumentImport({ content, onText, onDocument }) {
  const inputRef = useRef(null)
  const [state, setState] = useState({ status: 'idle' }) // idle | reading | done | error

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
      const text = await readDocx(file)
      if (!text) {
        setState({ status: 'error', message: 'לא מצאנו טקסט במסמך הזה.' })
        return
      }
      const joined = content.trim() ? `${content.trim()}\n\n${text}` : text
      if (joined.length > LIMITS.STORY_CONTENT_MAX) {
        setState({
          status: 'error',
          message: `המסמך ארוך מדי: אפשר עד ${LIMITS.STORY_CONTENT_MAX.toLocaleString('en-US')} תווים.`,
        })
        return
      }
      onText(joined)
      onDocument?.(file)
      setState({ status: 'done', name: file.name })
    } catch {
      setState({ status: 'error', message: 'לא הצלחנו לקרוא את המסמך. נסו לשמור אותו שוב כ-docx.' })
    }
  }

  return (
    <div className={styles.docImport}>
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
        disabled={state.status === 'reading'}
      >
        {state.status === 'reading'
          ? 'קוראים את המסמך…'
          : 'כבר כתבתם את הסיפור ב-Word? העלו את המסמך'}
      </button>
      <p className={styles.docStatus} aria-live="polite">
        {state.status === 'done' && (
          <>
            הטקסט מ-<bdi>{state.name}</bdi> נכנס לסיפור. עברו עליו לפני השליחה.
          </>
        )}
        {state.status === 'error' && <span className={styles.docError}>{state.message}</span>}
      </p>
    </div>
  )
}
