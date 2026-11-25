import { ACTIONS, VISIBILITY } from '@tamar70/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { errorMessage } from '../api/messages.js'
import { isBadYear, photoYear } from '../lib/photoYear.js'
import {
  Button,
  Chip,
  ErrorMessage,
  CardsSkeleton,
  Message,
  Spinner,
  TextField,
} from '../components'
import styles from './Admin.module.css'
import { useAdmin } from './adminContext.js'
import { formatBytes, formatDateTime, storyState } from './adminFormat.js'
import { useAdminStory, useAdminStoryThumbs } from './adminQueries.js'
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

function PhotoEditForm({ photo, busy, onSave, onCancel }) {
  const [name, setName] = useState(photo.caption || '')
  const [year, setYear] = useState(photo.year_approx ? String(photo.year_approx) : '')
  const [people, setPeople] = useState((photo.people || []).join(', '))
  const badYear = isBadYear(year)
  return (
    <form
      className={styles.photoForm}
      onSubmit={(e) => {
        e.preventDefault()
        if (badYear) return
        onSave({
          media_id: photo.id,
          caption: name.trim(),
          year_approx: photoYear(year),
          people: people
            .split(/[,،]/)
            .map((n) => n.trim())
            .filter(Boolean),
        })
      }}
    >
      <TextField
        label="שם התמונה"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
      />
      <TextField
        label="שנה"
        inputMode="numeric"
        dir="ltr"
        maxLength={4}
        value={year}
        onChange={(e) => setYear(e.target.value)}
        error={badYear ? 'שנה בין 1940 ל-2030' : undefined}
      />
      <TextField
        label="מי בתמונה"
        hint="שמות מופרדים בפסיק"
        value={people}
        onChange={(e) => setPeople(e.target.value)}
      />
      <div className={styles.photoFormActions}>
        <Button type="submit" disabled={Boolean(busy) || badYear}>
          שמירה
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={Boolean(busy)}>
          ביטול
        </Button>
      </div>
    </form>
  )
}

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
          {categories
            .filter((c) => c.active || c.id === values.category_id)
            .map((c) => (
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
  const photosLoaded = Array.isArray(data?.photos)
  const thumbs = useAdminStoryThumbs(
    id,
    photosLoaded ? data.photos.filter((p) => p.has_thumbnail).map((p) => p.id) : [],
  )
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(null) // what's being done, for the status line
  const [actionError, setActionError] = useState(null)
  const [done, setDone] = useState(null)
  const [photoToRemove, setPhotoToRemove] = useState(null)
  const [photoEditing, setPhotoEditing] = useState(null) // id of the photo being edited
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

  if (isPending) return <CardsSkeleton count={2} />
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

  const { story, categories, documents = [] } = data
  // Until the server answers, the story comes from the list and its photos are on the way.
  const photos = (data.photos ?? []).map((p) => ({
    ...p,
    thumbnail: thumbs.data?.thumbnails[p.id] ?? null,
  }))
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

      {documents.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>מסמך המקור</h2>
          <p className={styles.meta}>
            הטקסט של הסיפור נלקח מהמסמך הזה. הוא שמור ב-Drive ולא מוצג באתר.
          </p>
          <ul className={styles.recipients}>
            {documents.map((d) => (
              <li key={d.id}>
                <a href={d.link} target="_blank" rel="noreferrer">
                  <bdi>{d.filename}</bdi>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          תמונות ({photosLoaded ? photos.length : (story.media_count ?? 0)})
        </h2>
        {!photosLoaded ? (
          <Spinner label="טוען את התמונות" size="small" />
        ) : photos.length === 0 ? (
          <p className={styles.meta}>אין תמונות.</p>
        ) : (
          <ul className={styles.photos}>
            {photos.map((p) => (
              <li key={p.id} className={styles.photo}>
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt={p.caption || p.filename} className={styles.thumb} />
                ) : (
                  <span
                    className={styles.thumb}
                    data-loading={p.has_thumbnail && thumbs.isPending}
                  />
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
                {(p.people || []).length > 0 && (
                  <span className={styles.photoMeta}>{p.people.join(', ')}</span>
                )}
                {state !== 'deleted' && photoEditing !== p.id && (
                  <button
                    type="button"
                    className={styles.linkButton}
                    aria-label={`עריכת פרטי התמונה ${p.filename}`}
                    disabled={Boolean(busy)}
                    onClick={() => setPhotoEditing(p.id)}
                  >
                    עריכה
                  </button>
                )}
                {photoEditing === p.id && (
                  <PhotoEditForm
                    photo={p}
                    busy={busy}
                    onCancel={() => setPhotoEditing(null)}
                    onSave={async (values) => {
                      const ok = await run(
                        'שומרים',
                        ACTIONS.ADMIN_MEDIA_UPDATE,
                        values,
                        'פרטי התמונה נשמרו.',
                      )
                      if (ok) setPhotoEditing(null)
                    }}
                  />
                )}
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
    </div>
  )
}
