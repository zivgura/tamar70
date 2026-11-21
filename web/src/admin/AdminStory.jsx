import { ACTIONS, VISIBILITY } from '@tamar70/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { errorMessage } from '../api/messages.js'
import {
  Button,
  Chip,
  ErrorMessage,
  LoadingCards,
  Message,
  Spinner,
  TextField,
} from '../components'
import styles from './Admin.module.css'
import { useAdmin } from './adminContext.js'
import { formatBytes, formatDateTime, storyState } from './adminFormat.js'
import { useAdminStory } from './adminQueries.js'
import { ConfirmDialog } from './ConfirmDialog.jsx'
import { StateBadge } from './StateBadge.jsx'

const editable = (story) => ({
  title: story.title ?? '',
  excerpt: story.excerpt ?? '',
  content: story.content ?? '',
  author_name: story.author_name ?? '',
  author_relation: story.author_relation ?? '',
  category_id: story.category_id || 'general',
  admin_notes: story.admin_notes ?? '',
})

function EditForm({ story, categories, busy, onSave, onCancel }) {
  const [values, setValues] = useState(() => editable(story))
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }))
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        onSave(values)
      }}
    >
      <TextField label="כותרת" value={values.title} onChange={set('title')} maxLength={120} />
      <TextField
        label="הטיזר"
        hint="מה שרואים באתר עד החשיפה. השאירו ריק כדי לחזור למשפט הראשון של הסיפור."
        value={values.excerpt}
        onChange={set('excerpt')}
        maxLength={300}
        multiline
        rows={2}
      />
      <TextField
        label="הסיפור"
        value={values.content}
        onChange={set('content')}
        multiline
        rows={8}
      />
      <TextField
        label="שם הכותב/ת"
        value={values.author_name}
        onChange={set('author_name')}
        maxLength={60}
        required
      />
      <TextField
        label="הקשר לתמר"
        value={values.author_relation}
        onChange={set('author_relation')}
        maxLength={80}
      />
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>פינה</legend>
        <div className={styles.filters}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              selected={values.category_id === c.id}
              onClick={() => setValues((v) => ({ ...v, category_id: c.id }))}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </fieldset>
      <TextField
        label="הערות פנימיות"
        hint="רק מנהלות רואות את זה."
        value={values.admin_notes}
        onChange={set('admin_notes')}
        multiline
        rows={2}
      />
      <div className={styles.actions}>
        <Button type="submit" disabled={busy}>
          שמירה
        </Button>
        <Button type="button" variant="quiet" onClick={onCancel} disabled={busy}>
          ביטול
        </Button>
      </div>
    </form>
  )
}

/** /admin/story/:id: the whole story with its photos, and what admins can do with it. */
export default function AdminStory() {
  const { id } = useParams()
  const { call } = useAdmin()
  const queryClient = useQueryClient()
  const { data, isPending, error, refetch } = useAdminStory(id)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(null) // what's being done, for the status line
  const [actionError, setActionError] = useState(null)
  const [done, setDone] = useState(null)
  const [photoToRemove, setPhotoToRemove] = useState(null)
  const [commentToDelete, setCommentToDelete] = useState(null)
  const commentRef = useRef(null)
  const deleteRef = useRef(null)
  const photoRef = useRef(null)

  async function run(label, action, payload, doneMessage) {
    setBusy(label)
    setActionError(null)
    setDone(null)
    try {
      await call(action, payload)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'story', id] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'stories'] }),
        queryClient.invalidateQueries({ queryKey: ['bootstrap'] }),
      ])
      setDone(doneMessage)
      return true
    } catch (err) {
      setActionError(err)
      return false
    } finally {
      setBusy(null)
    }
  }

  if (isPending) return <LoadingCards count={2} />
  if (error) {
    if (error.code === 'not_found' || error.code === 'validation') {
      return (
        <Message>
          <p>הסיפור הזה לא נמצא.</p>
          <Link to="/admin">לכל הסיפורים</Link>
        </Message>
      )
    }
    return <ErrorMessage error={error} onRetry={refetch} />
  }

  const { story, photos, categories, comments = [] } = data
  const state = storyState(story)
  const category = categories.find((c) => c.id === story.category_id)

  return (
    <div className={styles.page}>
      <Link to="/admin" className={styles.back}>
        → לכל הסיפורים
      </Link>

      <div className={styles.storyHead}>
        <h1 className={styles.title}>{story.title || 'בלי כותרת'}</h1>
        <StateBadge story={story} />
      </div>
      <p className={styles.meta}>
        {story.author_name}
        {story.author_relation ? ` (${story.author_relation})` : ''} · {category?.name ?? 'כללי'}
        <br />
        נשלח ב-{formatDateTime(story.created_at)}
        {story.updated_at && story.updated_at !== story.created_at
          ? ` · עודכן ב-${formatDateTime(story.updated_at)}`
          : ''}
      </p>

      {(busy || actionError || done) && (
        <div className={styles.statusLine} role="status" aria-live="polite">
          {busy && <Spinner label={busy} size="small" />}
          {busy && <span>{busy}…</span>}
          {actionError && (
            <span className={styles.error} role="alert">
              {errorMessage(actionError)}
            </span>
          )}
          {done && !busy && <span>{done}</span>}
        </div>
      )}

      {editing ? (
        <EditForm
          story={story}
          categories={categories}
          busy={Boolean(busy)}
          onCancel={() => setEditing(false)}
          onSave={async (values) => {
            const saved = await run(
              'שומרים',
              ACTIONS.ADMIN_STORY_UPDATE,
              { id, ...values },
              'נשמר.',
            )
            if (saved) setEditing(false)
          }}
        />
      ) : (
        <>
          {story.excerpt && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>הטיזר באתר</h2>
              <p className={styles.excerpt}>{story.excerpt}</p>
            </section>
          )}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>הסיפור</h2>
            <p className={styles.content}>{story.content || 'בלי טקסט.'}</p>
          </section>
          {story.admin_notes && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>הערות פנימיות</h2>
              <p className={styles.content}>{story.admin_notes}</p>
            </section>
          )}
        </>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>תמונות ({photos.length})</h2>
        {photos.length === 0 ? (
          <p className={styles.meta}>אין תמונות.</p>
        ) : (
          <ul className={styles.photos}>
            {photos.map((p) => (
              <li key={p.id} className={styles.photo}>
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt={p.caption || p.filename} className={styles.thumb} />
                ) : (
                  <span className={styles.thumb} />
                )}
                <span className={styles.photoText}>
                  {p.caption || p.filename}
                  {p.upload_status !== 'done' && (
                    <span className={styles.badge} data-state="hidden">
                      {p.upload_status === 'pending' ? 'לא הסתיימה' : 'נכשלה'}
                    </span>
                  )}
                </span>
                <span className={styles.photoMeta}>
                  {[p.year_approx, formatBytes(p.bytes)].filter(Boolean).join(' · ')}
                </span>
                {state !== 'deleted' && (
                  <button
                    type="button"
                    className={styles.linkButton}
                    aria-label={`הסרת התמונה ${p.filename}`}
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setPhotoToRemove(p)
                      photoRef.current?.showModal?.()
                    }}
                  >
                    הסרה
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {comments.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>תגובות ({comments.length})</h2>
          <ul className={styles.list}>
            {comments.map((c) => (
              <li key={c.id} className={styles.commentRow}>
                <span className={styles.rowMeta}>
                  <strong>{c.author_name}</strong> · {formatDateTime(c.created_at)}
                </span>
                <span className={styles.content}>{c.content}</span>
                <button
                  type="button"
                  className={styles.linkButton}
                  aria-label={`מחיקת התגובה של ${c.author_name}`}
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setCommentToDelete(c)
                    commentRef.current?.showModal?.()
                  }}
                >
                  מחיקה
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state !== 'deleted' && !editing && (
        <div className={styles.actions}>
          <Button block onClick={() => setEditing(true)} disabled={Boolean(busy)}>
            עריכת הטקסט
          </Button>
          {state === 'hidden' ? (
            <Button
              block
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() =>
                run(
                  'מחזירים לאתר',
                  ACTIONS.ADMIN_VISIBILITY,
                  { id, visibility: VISIBILITY.DEFAULT },
                  'הסיפור חזר לאתר.',
                )
              }
            >
              החזרה לאתר
            </Button>
          ) : (
            <Button
              block
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() =>
                run(
                  'מסתירים',
                  ACTIONS.ADMIN_VISIBILITY,
                  { id, visibility: VISIBILITY.HIDDEN },
                  'הסיפור הוסתר. אפשר להחזיר אותו בכל רגע.',
                )
              }
            >
              הסתרה מהאתר
            </Button>
          )}
          {state === 'early' ? (
            <Button
              block
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() =>
                run(
                  'סוגרים',
                  ACTIONS.ADMIN_VISIBILITY,
                  { id, visibility: VISIBILITY.DEFAULT },
                  'הסיפור חזר להיות טיזר עד החשיפה.',
                )
              }
            >
              החזרה לטיזר עד החשיפה
            </Button>
          ) : (
            state === 'shown' && (
              <Button
                block
                variant="quiet"
                disabled={Boolean(busy)}
                onClick={() =>
                  run(
                    'פותחים',
                    ACTIONS.ADMIN_VISIBILITY,
                    { id, visibility: VISIBILITY.EARLY },
                    'הסיפור פתוח לקריאה כבר עכשיו, עם התמונות.',
                  )
                }
              >
                פתיחה לקריאה כבר עכשיו
              </Button>
            )
          )}
          <Button
            block
            variant="quiet"
            className={styles.danger}
            disabled={Boolean(busy)}
            onClick={() => deleteRef.current?.showModal?.()}
          >
            מחיקת הסיפור
          </Button>
        </div>
      )}

      <ConfirmDialog
        ref={deleteRef}
        title="למחוק את הסיפור?"
        confirmLabel="מחיקה"
        onConfirm={() => run('מוחקים', ACTIONS.ADMIN_STORY_DELETE, { id }, 'הסיפור נמחק.')}
      >
        הסיפור יירד מהאתר והתמונות שלו יעברו לפח של Drive. אם רק צריך להוריד אותו זמנית, עדיף
        להסתיר.
      </ConfirmDialog>

      <ConfirmDialog
        ref={photoRef}
        title="להסיר את התמונה?"
        confirmLabel="הסרה"
        onConfirm={() =>
          photoToRemove &&
          run('מסירים', ACTIONS.ADMIN_MEDIA_REMOVE, { media_id: photoToRemove.id }, 'התמונה הוסרה.')
        }
      >
        {photoToRemove?.thumbnail && (
          <img src={photoToRemove.thumbnail} alt="" className={styles.dialogPhoto} />
        )}
        התמונה תעבור לפח של Drive ולא תופיע באתר.
      </ConfirmDialog>

      <ConfirmDialog
        ref={commentRef}
        title="למחוק את התגובה?"
        confirmLabel="מחיקה"
        onConfirm={() =>
          commentToDelete &&
          run(
            'מוחקים',
            ACTIONS.ADMIN_COMMENT_DELETE,
            { comment_id: commentToDelete.id },
            'התגובה נמחקה.',
          )
        }
      >
        {commentToDelete &&
          `"${commentToDelete.content.slice(0, 120)}" — ${commentToDelete.author_name}`}
      </ConfirmDialog>
    </div>
  )
}
