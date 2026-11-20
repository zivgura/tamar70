import { STORY_KIND } from '@tamar70/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client.js'
import { errorMessage, REJECT_MESSAGES } from '../api/messages.js'
import { useBootstrap } from '../api/queries.js'
import { Button, ErrorMessage, LoadingCards, Spinner } from '../components'
import { rejectReason } from '../upload/uploadPhoto.js'
import styles from './Add.module.css'
import { AuthorStep } from './AuthorStep.jsx'
import { ContentStep } from './ContentStep.jsx'
import { forgetMine, splitList, tokenFor } from './deviceStore.js'
import { PhotoDialog } from './PhotoDialog.jsx'
import { PhotoGrid } from './PhotoGrid.jsx'
import { storyKind, uploadPhotos } from './sendStory.js'

let nextKey = 0
const joinList = (list) => (list ?? []).join(', ')

/** The server's photo, in the shape the photo grid and dialog use. */
const fromServer = (p) => ({
  key: p.id,
  mediaId: p.id,
  name: p.filename,
  url: p.thumbnail,
  caption: p.caption ?? '',
  year: p.year_approx ? String(p.year_approx) : '',
  people: joinList(p.people),
})

function Shell({ children }) {
  return <div className={styles.center}>{children}</div>
}

function EditForm({ own, editToken, categories, onReload }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState({
    kind: STORY_KIND.MIXED, // the form shows both the text and the photos
    category_id: own.category_id,
    title: own.title ?? '',
    content: own.content ?? '',
    decade: own.decade,
    place: joinList(own.places),
    people: joinList(own.people),
  })
  const [author, setAuthor] = useState({
    name: own.author_name ?? '',
    relation: own.author_relation ?? '',
  })
  const [photos, setPhotos] = useState(() => own.photos.map(fromServer))
  const [removed, setRemoved] = useState([])
  const [changed, setChanged] = useState(new Set())
  const [openPhoto, setOpenPhoto] = useState(null)
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('edit') // edit | saving | saved | photosFailed | deleted
  const [saveError, setSaveError] = useState(null)
  const confirmRef = useRef(null)

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const updatePhoto = (key, patch) =>
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
    // Marked stale without refetching: a refetch now would swap this form out mid-save.
    queryClient.invalidateQueries({ queryKey: ['own', own.id], refetchType: 'none' })
  }

  function addPhotos(files) {
    const added = files.map((file) => {
      const reason = rejectReason(file)
      return {
        key: `new-${++nextKey}`,
        file,
        name: file.name,
        url: URL.createObjectURL(file),
        rejected: reason ? REJECT_MESSAGES[reason] : null,
      }
    })
    setPhotos((list) => [...list, ...added])
  }

  function removePhoto(key) {
    const photo = photos.find((p) => p.key === key)
    if (photo?.mediaId) setRemoved((r) => [...r, photo.mediaId])
    setPhotos((list) => list.filter((p) => p.key !== key))
    setOpenPhoto(null)
  }

  async function save(e) {
    e.preventDefault()
    const kept = photos.filter((p) => !p.rejected)
    const found = {}
    if (!author.name.trim()) found.name = 'כתבו את השם שלכם'
    if (!draft.content.trim() && kept.length === 0) {
      found.content = 'כתבו כמה מילים, או השאירו לפחות תמונה אחת'
    }
    setErrors(found)
    if (Object.keys(found).length) return

    setSaveError(null)
    setPhase('saving')
    const owner = { story_id: own.id, edit_token: editToken }
    try {
      await api.updateOwn({
        id: own.id,
        edit_token: editToken,
        kind: storyKind(draft.content, kept.length),
        author_name: author.name.trim(),
        author_relation: author.relation.trim(),
        title: draft.title.trim(),
        content: draft.content.trim(),
        category_id: draft.category_id,
        ...(draft.decade ? { decade: draft.decade } : {}),
        places: splitList(draft.place),
        people: splitList(draft.people),
      })
      for (const mediaId of removed) await api.removeOwnPhoto({ ...owner, media_id: mediaId })
      for (const p of kept.filter((p) => p.mediaId && changed.has(p.key))) {
        const year = Number.parseInt(p.year, 10)
        await api.updateOwnPhoto({
          ...owner,
          media_id: p.mediaId,
          caption: p.caption,
          year_approx: Number.isInteger(year) && year >= 1940 && year <= 2030 ? year : null,
          people: splitList(p.people),
        })
      }
      setRemoved([])
      setChanged(new Set())
    } catch (err) {
      setSaveError(err)
      setPhase('edit')
      return
    }

    const fresh = kept.filter((p) => !p.mediaId)
    fresh.forEach((p) => updatePhoto(p.key, { stage: 'queued', progress: 0 }))
    const failed = await uploadPhotos({
      storyId: own.id,
      editToken,
      photos: fresh,
      onPhoto: updatePhoto,
    })
    refresh()
    setPhase(failed ? 'photosFailed' : 'saved')
  }

  async function deleteStory() {
    confirmRef.current?.close()
    setPhase('saving')
    try {
      await api.deleteOwn({ id: own.id, edit_token: editToken })
      forgetMine(own.id)
      refresh()
      setPhase('deleted')
    } catch (err) {
      setSaveError(err)
      setPhase('edit')
    }
  }

  if (phase === 'deleted') {
    return (
      <Shell>
        <h1 className={styles.title}>הסיפור נמחק</h1>
        <p className={styles.status}>הוא כבר לא מופיע באתר.</p>
        <Button as={Link} to="/" block>
          לדף הבית
        </Button>
      </Shell>
    )
  }

  if (phase === 'saved') {
    return (
      <Shell>
        <h1 className={styles.title}>השינויים נשמרו</h1>
        <div className={styles.actions}>
          <Button as={Link} to={`/story/${own.id}`} block>
            לסיפור
          </Button>
          <Button as={Link} to="/" variant="quiet" block>
            לדף הבית
          </Button>
        </div>
      </Shell>
    )
  }

  if (phase === 'saving' || phase === 'photosFailed') {
    const uploading = photos.some((p) => p.stage)
    return (
      <Shell>
        <div className={styles.sendingHead}>
          {phase === 'saving' && <Spinner label="שומרים" className={styles.bigSpinner} />}
          <h1 className={styles.title}>{phase === 'saving' ? 'שומרים…' : 'כמעט סיימנו'}</h1>
          <p className={styles.status} aria-live="polite">
            {phase === 'photosFailed'
              ? 'השינויים נשמרו, אבל חלק מהתמונות החדשות לא הועלו.'
              : uploading
                ? 'השינויים נשמרו. מעלים את התמונות החדשות.'
                : 'שומרים את השינויים…'}
          </p>
        </div>
        {uploading && <PhotoGrid photos={photos.filter((p) => p.stage)} sending />}
        {phase === 'photosFailed' && (
          <div className={styles.actions}>
            <Button block onClick={onReload}>
              חזרה לעריכה
            </Button>
          </div>
        )}
      </Shell>
    )
  }

  return (
    <form className={styles.page} noValidate onSubmit={save}>
      <div className={styles.body}>
        <Link to={`/story/${own.id}`} className={styles.backLink}>
          → חזרה לסיפור
        </Link>
        <h1 className={styles.title}>עריכת הסיפור</h1>
        <p className={styles.lead}>אפשר לשנות עד שהסיפורים נחשפים ביום ההולדת.</p>

        <AuthorStep author={author} setAuthor={setAuthor} errors={errors} withHeading={false} />
        <ContentStep
          draft={draft}
          update={update}
          categories={categories}
          photos={photos}
          onAddPhotos={addPhotos}
          onOpenPhoto={setOpenPhoto}
          errors={errors}
          withHeading={false}
        />
      </div>

      <div className={styles.footer}>
        {saveError && (
          <p className={styles.error} role="alert">
            {errorMessage(saveError)}
          </p>
        )}
        <Button type="submit" block>
          שמירת השינויים
        </Button>
        <Button
          type="button"
          variant="quiet"
          block
          className={styles.dangerButton}
          onClick={() => confirmRef.current?.showModal?.()}
        >
          מחיקת הסיפור
        </Button>
      </div>

      <PhotoDialog
        photo={openPhoto}
        onClose={() => setOpenPhoto(null)}
        onSave={(key, values) => {
          updatePhoto(key, values)
          setChanged((c) => new Set(c).add(key))
        }}
        onRemove={removePhoto}
      />

      <dialog ref={confirmRef} className={styles.dialog} aria-label="מחיקת הסיפור">
        <div className={styles.dialogForm}>
          <h2 className={styles.dialogTitle}>למחוק את הסיפור?</h2>
          <p>הסיפור והתמונות שלו יוסרו מהאתר. אי אפשר לבטל את זה.</p>
          <div className={styles.dialogActions}>
            <Button type="button" className={styles.dangerFill} onClick={deleteStory}>
              מחיקה
            </Button>
            <Button type="button" variant="quiet" onClick={() => confirmRef.current?.close()}>
              ביטול
            </Button>
          </div>
        </div>
      </dialog>
    </form>
  )
}

/** /edit/:id — change or delete a story, from the device that sent it, until publish. */
export default function EditStory() {
  const { id } = useParams()
  const editToken = tokenFor(id)
  const boot = useBootstrap()
  const [version, setVersion] = useState(0)
  const own = useQuery({
    queryKey: ['own', id],
    queryFn: () => api.getOwn({ id, edit_token: editToken }),
    enabled: Boolean(editToken),
  })

  if (!editToken) {
    return (
      <Shell>
        <h1 className={styles.title}>אי אפשר לערוך מכאן</h1>
        <p className={styles.status}>אפשר לערוך סיפור רק מהמכשיר שממנו הוא נשלח.</p>
        <Link to="/">לדף הבית</Link>
      </Shell>
    )
  }
  if (own.error || boot.error) {
    const err = own.error ?? boot.error
    if (err.code === 'forbidden') forgetMine(id)
    if (err.code === 'forbidden' || err.code === 'editing_closed') {
      return (
        <Shell>
          <h1 className={styles.title}>אי אפשר לערוך את הסיפור</h1>
          <p className={styles.status}>
            {err.code === 'forbidden' ? 'הסיפור הזה כבר לא קיים.' : errorMessage(err)}
          </p>
          <Link to="/">לדף הבית</Link>
        </Shell>
      )
    }
    return <ErrorMessage error={err} onRetry={() => (own.error ? own.refetch() : boot.refetch())} />
  }
  if (own.isPending || boot.isPending) {
    return (
      <Shell>
        <LoadingCards count={2} />
      </Shell>
    )
  }
  return (
    <EditForm
      key={version}
      own={own.data}
      editToken={editToken}
      categories={boot.data.categories}
      onReload={async () => {
        await own.refetch()
        setVersion((v) => v + 1)
      }}
    />
  )
}
