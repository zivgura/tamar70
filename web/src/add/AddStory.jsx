import { DEFAULT_CATEGORY_ID, makeExcerpt, STORY_KIND } from '@tamar70/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { newEditToken } from '../api/client.js'
import { errorMessage } from '../api/messages.js'
import { findCategory, useBootstrap } from '../api/queries.js'
import { Button, ErrorMessage, Skeleton, SkeletonGroup, Spinner, StoryCard } from '../components'
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
import { PhotoGrid } from './PhotoGrid.jsx'
import { createStory, submission, uploadPhotos, uploadDocuments } from './sendStory.js'
import { StepHeader } from './StepHeader.jsx'
import { useLang } from '../i18n/i18n.js'
import { useWakeLock } from '../lib/useWakeLock.js'

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
function stepErrors(step, draft, photos, author, t) {
  const errors = {}
  if (step === STEP_AUTHOR && !author.name.trim()) errors.name = t('add.needName')
  if (step === STEP_CONTENT) {
    const usable = photos.filter((p) => !p.rejected)
    if (draft.kind !== STORY_KIND.PHOTOS && !draft.content.trim()) {
      errors.content = t('add.needContent')
    }
    if (draft.kind === STORY_KIND.PHOTOS && usable.length === 0) {
      errors.photos = t('add.needPhoto')
    }
  }
  return errors
}

function Gate({ children }) {
  const { t } = useLang()
  return (
    <div className={styles.gate}>
      {children}
      <Link to="/">{t('common.home')}</Link>
    </div>
  )
}

/** /add: the three-step "add a story" flow. */
export default function AddStory() {
  const [params] = useSearchParams()
  const { lang, t } = useLang()
  const { data, error: bootError, isPending, refetch } = useBootstrap()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState(() => initialDraft(params.get('corner')))
  const [author, setAuthor] = useState(loadAuthor)
  const [photos, setPhotos] = useState([])
  // Word files whose text went into the story; kept in Drive after sending.
  const [documents, setDocuments] = useState([])
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('edit') // edit | sending | photosFailed | done
  useWakeLock(phase === 'sending')
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
      return {
        key: ++nextPhotoKey,
        file,
        name: file.name,
        url,
        rejected: reason || null, // the reason's code; PhotoGrid shows its text
      }
    })
    setPhotos((list) => [...list, ...added])
    setErrors((e) => ({ ...e, photos: undefined }))
  }

  function goNext() {
    const found = stepErrors(draft.step, draft, photos, author, t)
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
          submission({ draft, author, photos: toUpload, editToken: editToken.current }),
        ))
      rememberMine(storyId, editToken.current)
      setSent({ storyId, editToken: editToken.current })
      clearDraft()
      // Word files (best effort) go up alongside the photos instead of before them.
      const docs = documents.length
        ? uploadDocuments({ storyId, editToken: editToken.current, files: documents })
        : null
      setDocuments([])
      setPhotos(toUpload.map((p) => ({ ...p, stage: 'queued', progress: 0 })))
      await Promise.all([finishPhotos(storyId, toUpload), docs])
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

  // Gates: server unreachable, still loading, submissions closed.
  if (bootError) return <ErrorMessage error={bootError} onRetry={refetch} />
  if (isPending) {
    return (
      <SkeletonGroup className={styles.page}>
        <div className={styles.body}>
          <Skeleton size="md" width="1/3" />
          <Skeleton size="4xl" width="2/3" />
          <Skeleton width="3/4" />
          <div className={styles.tiles}>
            <Skeleton shape="block" size="choice" />
            <Skeleton shape="block" size="choice" />
            <Skeleton shape="block" size="choice" />
          </div>
        </div>
      </SkeletonGroup>
    )
  }
  if (!data.site.submissions_open) {
    return (
      <Gate>
        <h1 className={styles.title}>{t('add.closed')}</h1>
        <p>{t('add.closedLead')}</p>
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
    // Contributors can change their story until the reveal.
    const editable = data.site.site_status === 'collecting'
    return (
      <div className={styles.center}>
        <h1 className={styles.title}>{t('add.thanks')}</h1>
        <p className={styles.status}>
          {editable
            ? t('add.savedEditable', { date: formatDay(data.site.birthday_date, lang) })
            : t('add.savedOpen')}
        </p>
        <StoryCard story={preview} category={category} linked={false} />
        <div className={styles.actions}>
          {editable && (
            <Button as={Link} to={`/edit/${sent.storyId}`} variant="secondary" block>
              {t('add.editStory')}
            </Button>
          )}
          <Button block onClick={startOver}>
            {t('add.another')}
          </Button>
          <Button as={Link} to="/" variant="quiet" block>
            {t('common.home')}
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
            <Spinner label={t('add.sendingLabel')} className={styles.bigSpinner} />
          )}
          <h1 className={styles.title}>
            {phase === 'sending' ? t('add.sending') : t('add.almost')}
          </h1>

          <p className={styles.status} aria-live="polite">
            {!sent
              ? t('add.saving')
              : phase === 'sending'
                ? t('add.uploading', { done: uploaded, total: photos.length })
                : t('add.someFailed', { n: failed })}
          </p>
        </div>
        {photos.length > 0 && <PhotoGrid photos={photos} />}
        {phase === 'photosFailed' && (
          <div className={styles.actions}>
            <Button block onClick={retryFailed}>
              {t('add.retryUpload')}
            </Button>
            <Button variant="quiet" block onClick={() => setPhase('done')}>
              {t('add.finishWithout', { n: failed })}
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
              onDocument={(file) => setDocuments((list) => [...list, file].slice(-3))}
              onChangePhoto={updatePhoto}
              onRemovePhoto={(key) => setPhotos((list) => list.filter((p) => p.key !== key))}
              errors={errors}
              photosLostFromDraft={photosLostFromDraft && photos.length === 0}
            />
          )}
        </div>

        {draft.step > 1 && (
          <div className={styles.footer}>
            {draft.step === STEP_CONTENT && <p className={styles.consent}>{t('add.consent')}</p>}
            {sendError && (
              <p className={styles.error} role="alert">
                {errorMessage(sendError, lang)}
              </p>
            )}
            <Button type="submit" block>
              {draft.step === STEP_CONTENT ? t('add.send') : t('add.next')}
            </Button>
            {draft.step === STEP_CONTENT && (
              <p className={styles.footerNote}>{t('add.draftSaved')}</p>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
