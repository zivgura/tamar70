import { googleDocId, LIMITS } from '@tamar70/shared'
import { useRef, useState } from 'react'
import { api } from '../api/client.js'
import { errorMessage } from '../api/messages.js'
import { ChevronDownIcon, DocumentUploadIcon } from '../components/icons.js'
import { isDocx, readDocx } from '../lib/readDocx.js'
import styles from './Add.module.css'
import { useLang } from '../i18n/i18n.js'

/**
 * "Already wrote it?": a Word file or a Google Docs link. The text goes into the story box,
 * for the person to check before sending. A Word file itself goes to `onDocument`, to be kept
 * with the story.
 */
export function DocumentImport({ content, onText, onDocument }) {
  const { lang, t } = useLang()
  const inputRef = useRef(null)
  const [link, setLink] = useState('')
  const [state, setState] = useState({ status: 'idle' }) // idle | reading | done | error
  const reading = state.status === 'reading'

  /** Adds the text below what's already typed. False (with a message) if it can't. */
  function applyText(text, source) {
    if (!text) {
      setState({ status: 'error', message: t('doc.empty') })
      return false
    }
    const joined = content.trim() ? `${content.trim()}\n\n${text}` : text
    if (joined.length > LIMITS.STORY_CONTENT_MAX) {
      setState({
        status: 'error',
        message: t('doc.tooLong', { max: LIMITS.STORY_CONTENT_MAX.toLocaleString('en-US') }),
      })
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
      setState({ status: 'error', message: t('doc.wordOnly') })
      return
    }
    setState({ status: 'reading' })
    try {
      if (applyText(await readDocx(file), t('doc.fromFile', { name: file.name })))
        onDocument?.(file)
    } catch {
      setState({ status: 'error', message: t('doc.unreadable') })
    }
  }

  async function importLink(e) {
    e.preventDefault()
    if (!googleDocId(link)) {
      setState({ status: 'error', message: t('error.doc_bad_link') })
      return
    }
    setState({ status: 'reading' })
    try {
      const { text } = await api.importGoogleDoc(link.trim())
      if (applyText(text, t('doc.fromGoogle'))) setLink('')
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err, lang) })
    }
  }

  // Closed by default: most people type here; those who already wrote open it.
  return (
    <details className={styles.docPanel}>
      <summary className={styles.docSummary}>
        <span className={styles.docIcon} aria-hidden="true">
          <DocumentUploadIcon />
        </span>
        <span className={styles.docSummaryText}>
          <span className={styles.summaryTitle}>
            {t('doc.title')} <span className={styles.optionalTag}>{t('common.optional')}</span>
          </span>
          <span className={styles.hint}>{t('doc.hint')}</span>
        </span>
        <ChevronDownIcon className={styles.docChevron} aria-hidden="true" />
      </summary>
      <div className={styles.docImport}>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="visually-hidden"
          tabIndex={-1}
          onChange={pick}
          aria-label={t('doc.pickWord')}
        />
        <button
          type="button"
          className={styles.docButton}
          onClick={() => inputRef.current?.click()}
          disabled={reading}
        >
          {t('doc.uploadWord')}
        </button>

        {/* A div, not a form: this sits inside the story form. Enter imports. */}
        <div className={styles.docLink}>
          <label htmlFor="google-doc-link" className={styles.docHint}>
            {t('doc.orLink')}
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
              {t('doc.import')}
            </button>
          </div>
          <p className={styles.docSmall}>{t('doc.shareTip')}</p>
        </div>

        <p className={styles.docStatus} aria-live="polite">
          {reading && t('doc.reading')}
          {state.status === 'done' && (
            <>
              {t('doc.added', { source: '\u0000' }).split('\u0000')[0]}
              <bdi>{state.source}</bdi>
              {t('doc.added', { source: '\u0000' }).split('\u0000')[1]}
            </>
          )}
          {state.status === 'error' && <span className={styles.docError}>{state.message}</span>}
        </p>
      </div>
    </details>
  )
}
