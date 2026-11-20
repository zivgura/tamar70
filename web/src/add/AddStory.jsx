import { DEFAULT_CATEGORY_ID, makeExcerpt, STORY_KIND } from '@tamar70/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { newEditToken } from '../api/client.js'
import { errorMessage, REJECT_MESSAGES } from '../api/messages.js'
import { findCategory, useBootstrap } from '../api/queries.js'
import { Button, ErrorMessage, LoadingCards, Spinner, StoryCard } from '../components'
import { readFamilyCode } from '../lib/familyCode.js'
import { formatDay } from '../lib/format.js'
import { rejectReason } from '../upload/uploadPhoto.js'
import styles from './Add.module.css'
import { AuthorStep } from './AuthorStep.jsx'
import { ContentStep } from './ContentStep.jsx'
import {
  clearDraft,
  EMPTY_DRAFT,
  loadAuthor,
  loadDraft,
  rememberMine,
  saveAuthor,
  saveDraft,
} from './deviceStore.js'
import { KindStep } from './KindStep.jsx'
import { PhotoDialog } from './PhotoDialog.jsx'
import { PhotoGrid } from './PhotoGrid.jsx'
import { createStory, submission, uploadPhotos } from './sendStory.js'
import { StepHeader } from './StepHeader.jsx'

let nextPhotoKey = 0

function initialDraft(cornerFromLink) {
  const saved = loadDraft()
  const draft = saved ? { ...saved, step: Math.min(saved.step, 3) } : { ...EMPTY_DRAFT }
  if (cornerFromLink && !saved?.category_id) draft.category_id = cornerFromLink
  return draft
}

// The steps: 1 what to share, 2 who's writing, 3 the story itself (then send).
const STEP_AUTHOR = 2
const STEP_CONTENT = 3

/** What's missing before leaving a step, as { field: message }. */
function stepErrors(step, draft, photos, author) {
  const errors = {}
  if (step === STEP_AUTHOR && !author.name.trim()) errors.name = 'כתבו את השם שלכם'
  if (step === STEP_CONTENT) {
    const usable = photos.filter((p) => !p.rejected)
    if (draft.kind !== STORY_KIND.PHOTOS && !draft.content.trim()) {
      errors.content = 'כתבו כמה מילים, אפילו משפט אחד'
    }
    if (draft.kind === STORY_KIND.PHOTOS && usable.length === 0) {
      errors.photos = 'בחרו לפחות תמונה אחת'
    }
  }
  return errors
}

function Gate({ children }) {
  return (
    <div className={styles.gate}>
      {children}
      <Link to="/">לדף הבית</Link>
    </div>
  )
}

/** /add: the three-step "add a story" flow. */
export default function AddStory() {
  const [params] = useSearchParams()
  const { data, error: bootError, isPending, refetch } = useBootstrap()
  const queryClient = useQueryClient()
  const familyCode = readFamilyCode()

  const [draft, setDraft] = useState(() => initialDraft(params.get('corner')))
  const [author, setAuthor] = useState(loadAuthor)
  const [photos, setPhotos] = useState([])
  const [openPhoto, setOpenPhoto] = useState(null)
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('edit') // edit | sending | photosFailed | done
  const [sendError, setSendError] = useState(null)
  const [sent, setSent] = useState(null) // { storyId, editToken }
  const [photosLostFromDraft] = useState(() => {
    const saved = loadDraft()
    return Boolean(
      saved && saved.kind && saved.kind !== STORY_KIND.TEXT && saved.step >= STEP_CONTENT,
    )
  })
  const editToken = useRef(null)
  const urls = useRef([])

  useEffect(() => {
    if (phase === 'edit') saveDraft(draft)
  }, [draft, phase])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])
  // Block body on purpose: Chrome's scrollTo returns a Promise, and an effect must not return
  // anything but a cleanup function.
  useEffect(() => {
    window.scrollTo?.(0, 0)
  }, [draft.step, phase])

  const update = (patch) => {
    setDraft((d) => ({ ...d, ...patch }))
    setErrors((e) =>
      Object.fromEntries(
        Object.keys(e)
          .filter((k) => !(k in patch))
          .map((k) => [k, e[k]]),
      ),
    )
  }
  const updatePhoto = (key, patch) =>
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  function addPhotos(files) {
    const added = files.map((file) => {
      const url = URL.createObjectURL(file)
      urls.current.push(url)
      const reason = rejectReason(file)
      return { key: ++nextPhotoKey, file, url, rejected: reason ? REJECT_MESSAGES[reason] : null }
    })
    setPhotos((list) => [...list, ...added])
    setErrors((e) => ({ ...e, photos: undefined }))
  }

  function goNext() {
    const found = stepErrors(draft.step, draft, photos, author)
    setErrors(found)
    if (Object.keys(found).length) return
    if (draft.step === STEP_AUTHOR) saveAuthor(author)
    if (draft.step < STEP_CONTENT) update({ step: draft.step + 1 })
    else send()
  }

  async function send() {
    const toUpload = photos.filter((p) => !p.rejected)
    saveAuthor(author)
    setSendError(null)
    setPhase('sending')
    editToken.current ??= newEditToken()
    try {
      const storyId =
        sent?.storyId ??
        (await createStory(
          submission({ draft, author, photos: toUpload, familyCode, editToken: editToken.current }),
        ))
      rememberMine(storyId, editToken.current)
      setSent({ storyId, editToken: editToken.current })
      clearDraft()
      setPhotos(toUpload.map((p) => ({ ...p, stage: 'queued', progress: 0 })))
      await finishPhotos(storyId, toUpload)
    } catch (err) {
      setSendError(err)
      setPhase('edit')
    }
  }

  async function finishPhotos(storyId, list) {
    const failed = await uploadPhotos({
      storyId,
      editToken: editToken.current,
      photos: list,
      onPhoto: updatePhoto,
    })
    queryClient.invalidateQueries({ queryKey: ['bootstrap'] })
    setPhase(failed ? 'photosFailed' : 'done')
  }

  function retryFailed() {
    const failed = photos.filter((p) => p.stage === 'error')
    failed.forEach((p) => updatePhoto(p.key, { stage: 'queued', progress: 0, error: null }))
    setPhase('sending')
    finishPhotos(sent.storyId, failed)
  }

  function startOver() {
    editToken.current = null
    setSent(null)
    setPhotos([])
    setDraft({ ...EMPTY_DRAFT })
    setErrors({})
    setPhase('edit')
  }

  // Gates: no family link, server unreachable, still loading, submissions closed.
  if (!familyCode) {
    return (
      <Gate>
        <h1 className={styles.title}>צריך את הקישור המשפחתי</h1>
        <p>כדי להוסיף סיפור, היכנסו לאתר מהקישור ששלחו לכם. אם אין לכם אותו, בקשו אותו מהמשפחה.</p>
      </Gate>
    )
  }
  if (bootError) return <ErrorMessage error={bootError} onRetry={refetch} />
  if (isPending) {
    return (
      <div className={styles.center}>
        <LoadingCards count={1} />
      </div>
    )
  }
  if (!data.site.submissions_open) {
    return (
      <Gate>
        <h1 className={styles.title}>ההוספה סגורה כרגע</h1>
        <p>אפשר לקרוא את הסיפורים שכבר נאספו.</p>
      </Gate>
    )
  }

  const category = findCategory(data.categories, draft.category_id ?? DEFAULT_CATEGORY_ID)
  const uploaded = photos.filter((p) => p.stage === 'done').length

  if (phase === 'done') {
    const preview = {
      view: 'teaser',
      id: sent.storyId,
      kind: draft.kind,
      title: draft.title.trim(),
      excerpt: makeExcerpt(draft.content),
      author_name: author.name.trim(),
      author_relation: author.relation.trim(),
      category_id: category?.id,
      media_count: uploaded,
      created_at: new Date().toISOString(),
    }
    return (
      <div className={styles.center}>
        <h1 className={styles.title}>תודה!</h1>
        <p className={styles.status}>
          הסיפור נשמר ומופיע באתר עכשיו. הוא ייחשף במלואו ב-{formatDay(data.site.birthday_date)}.
        </p>
        <StoryCard story={preview} category={category} linked={false} />
        <div className={styles.actions}>
          <Button block onClick={startOver}>
            הוסיפו סיפור נוסף
          </Button>
          <Button as={Link} to="/" variant="quiet" block>
            לדף הבית
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'sending' || phase === 'photosFailed') {
    const failed = photos.filter((p) => p.stage === 'error').length
    return (
      <div className={styles.center}>
        <div className={styles.sendingHead}>
          {phase === 'sending' && (
            <Spinner label="שולחים את הסיפור" className={styles.bigSpinner} />
          )}
          <h1 className={styles.title}>{phase === 'sending' ? 'שולחים…' : 'כמעט סיימנו'}</h1>

          <p className={styles.status} aria-live="polite">
            {!sent
              ? 'שומרים את הסיפור…'
              : phase === 'sending'
                ? `הסיפור נשמר. מעלים את התמונות (${uploaded} מתוך ${photos.length}).`
                : `הסיפור נשמר, אבל ${failed === 1 ? 'תמונה אחת לא הועלתה' : `${failed} תמונות לא הועלו`}.`}
          </p>
        </div>
        {photos.length > 0 && <PhotoGrid photos={photos} sending />}
        {phase === 'photosFailed' && (
          <div className={styles.actions}>
            <Button block onClick={retryFailed}>
              נסו שוב להעלות
            </Button>
            <Button variant="quiet" block onClick={() => setPhase('done')}>
              סיום בלי {failed === 1 ? 'התמונה הזו' : 'התמונות האלה'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <StepHeader step={draft.step} onBack={() => update({ step: draft.step - 1 })} />
      <form
        className={styles.page}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          goNext()
        }}
      >
        <div className={styles.body}>
          {draft.step === 1 && (
            <KindStep kind={draft.kind} onChange={(kind) => update({ kind, step: 2 })} />
          )}
          {draft.step === STEP_AUTHOR && (
            <AuthorStep author={author} setAuthor={setAuthor} errors={errors} />
          )}
          {draft.step === STEP_CONTENT && (
            <ContentStep
              draft={draft}
              update={update}
              categories={data.categories}
              photos={photos}
              onAddPhotos={addPhotos}
              onOpenPhoto={setOpenPhoto}
              errors={errors}
              photosLostFromDraft={photosLostFromDraft && photos.length === 0}
            />
          )}
        </div>

        {draft.step > 1 && (
          <div className={styles.footer}>
            {draft.step === STEP_CONTENT && (
              <p className={styles.consent}>
                הסיפור והתמונות יהיו גלויים לכל מי שיש לו את קישור האתר, ועשויים לשמש במשחק משפחתי
                ליום ההולדת.
              </p>
            )}
            {sendError && (
              <p className={styles.error} role="alert">
                {errorMessage(sendError)}
              </p>
            )}
            <Button type="submit" block>
              {draft.step === STEP_CONTENT ? 'שליחה' : 'המשך'}
            </Button>
            {draft.step === STEP_CONTENT && (
              <p className={styles.footerNote}>הטיוטה נשמרת אוטומטית במכשיר</p>
            )}
          </div>
        )}
      </form>

      <PhotoDialog
        photo={openPhoto}
        onClose={() => setOpenPhoto(null)}
        onSave={(key, values) => updatePhoto(key, values)}
        onRemove={(key) => {
          setPhotos((list) => list.filter((p) => p.key !== key))
          setOpenPhoto(null)
        }}
      />
    </div>
  )
}
