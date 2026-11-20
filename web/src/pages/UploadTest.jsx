import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, newEditToken } from '../api/client.js'
import { errorMessage, REJECT_MESSAGES } from '../api/messages.js'
import { Button, ProgressBar, TextField } from '../components'
import { rejectReason, uploadPhoto } from '../upload/uploadPhoto.js'
import styles from './UploadTest.module.css'

// Milestone 3 proof of concept, at /_upload-test (not linked). Creates a real photos-only
// story and uploads the chosen photos straight to Drive. The real flow comes in milestone 4.

const STAGE_TEXT = {
  queued: 'ממתינה',
  starting: 'מתחילה…',
  uploading: 'מעלה…',
  confirming: 'מאמתת…',
  retrying: 'מנסה שוב…',
  done: 'הועלתה',
  error: 'נכשלה',
}

let nextKey = 0

export default function UploadTest() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('k') ?? '')
  const [name, setName] = useState('בדיקת העלאה')
  const [photos, setPhotos] = useState([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState([])
  const urls = useRef([])

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const update = (key, patch) =>
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  const note = (line) => setLog((l) => [...l, `${new Date().toLocaleTimeString()} ${line}`])

  function addFiles(fileList) {
    const added = Array.from(fileList).map((file) => {
      const url = URL.createObjectURL(file)
      urls.current.push(url)
      const reason = rejectReason(file)
      return {
        key: ++nextKey,
        file,
        url,
        progress: 0,
        stage: reason ? 'error' : 'queued',
        message: reason ? REJECT_MESSAGES[reason] : '',
      }
    })
    setPhotos((list) => [...list, ...added])
  }

  async function run(e) {
    e.preventDefault()
    setError('')
    const queue = photos.filter((p) => p.stage === 'queued')
    if (!queue.length) return setError('בחרו לפחות תמונה אחת')
    setRunning(true)
    try {
      const editToken = newEditToken()
      const t0 = performance.now()
      const { id: storyId } = await api.submitStory({
        edit_token: editToken,
        family_code: code,
        kind: 'photos',
        author_name: name,
        title: 'בדיקת העלאה',
      })
      note(`story ${storyId} (${Math.round(performance.now() - t0)} ms)`)

      for (const p of queue) {
        const started = performance.now()
        try {
          const result = await uploadPhoto({
            file: p.file,
            storyId,
            editToken,
            onStage: (stage) => update(p.key, { stage }),
            onProgress: (progress) => update(p.key, { progress }),
          })
          update(p.key, { stage: 'done', progress: 1 })
          const secs = ((performance.now() - started) / 1000).toFixed(1)
          note(`${p.file.name}: ${result.media_id} ${result.width}x${result.height}, ${secs} s`)
        } catch (err) {
          update(p.key, { stage: 'error', message: errorMessage(err) })
          note(`${p.file.name}: ${err.code ?? err.name} ${err.message}`)
        }
      }
    } catch (err) {
      setError(errorMessage(err))
      note(`story: ${err.code ?? err.name} ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className={styles.page}>
      <h1>בדיקת העלאת תמונות</h1>
      <p className={styles.notice}>
        עמוד בדיקה פנימי. הוא יוצר סיפור אמיתי מסוג &quot;תמונות&quot; ומעלה את התמונות ישירות
        לתיקייה ב-Drive.
      </p>

      <form className={styles.form} onSubmit={run}>
        <TextField
          label="קוד משפחה"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          dir="ltr"
          required
        />
        <TextField label="שם" value={name} onChange={(e) => setName(e.target.value)} required />

        <div className={styles.photos}>
          {photos.map((p) => (
            <div key={p.key} className={styles.photo}>
              <img className={styles.thumb} src={p.url} alt={p.file.name} />
              <ProgressBar
                value={p.progress}
                label={p.file.name}
                state={p.stage === 'done' ? 'done' : p.stage === 'error' ? 'error' : 'active'}
              />
              <span
                className={[
                  styles.status,
                  p.stage === 'done' ? styles.statusDone : '',
                  p.stage === 'error' ? styles.statusError : '',
                ].join(' ')}
              >
                {p.message || STAGE_TEXT[p.stage]}
                {p.stage === 'uploading' && ` ${Math.round(p.progress * 100)}%`}
              </span>
            </div>
          ))}
          <label className={styles.picker}>
            <span aria-hidden="true">+</span>
            הוסיפו תמונות
            <input
              className="visually-hidden"
              type="file"
              accept="image/*"
              multiple
              disabled={running}
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        <Button type="submit" block disabled={running}>
          {running ? 'מעלה…' : 'העלאה'}
        </Button>
      </form>

      {log.length > 0 && <pre className={styles.log}>{log.join('\n')}</pre>}
    </main>
  )
}
