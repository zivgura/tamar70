import { currentCategoryId, DEFAULT_CATEGORY_ID, LIMITS, STORY_KIND } from '@tamar70/shared'
import { useRef } from 'react'
import { Chip, TextField } from '../components'
import styles from './Add.module.css'
import { DocumentImport } from './DocumentImport.jsx'
import { PhotoFields } from './PhotoFields.jsx'
import { useLang } from '../i18n/i18n.js'

const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]

/** Step 3: the corner, the text, the photos and the optional details. */
export function ContentStep({
  draft,
  update,
  categories,
  photos,
  onAddPhotos,
  onChangePhoto,
  onRemovePhoto,
  errors,
  photosLostFromDraft,
  onDocument,
  withHeading = true,
}) {
  const { t } = useLang()
  const storyRef = useRef(null)
  const wantsText = draft.kind !== STORY_KIND.PHOTOS
  const wantsPhotos = draft.kind !== STORY_KIND.TEXT
  // A draft saved before two corners were merged still points at the old one.
  const chosenId = currentCategoryId(draft.category_id ?? DEFAULT_CATEGORY_ID)
  const category = categories.find((c) => c.id === chosenId)

  /** After a document is imported: scroll to the story box, where its text now is. */
  function showStory() {
    requestAnimationFrame(() => {
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      storyRef.current?.scrollIntoView?.({ behavior: still ? 'auto' : 'smooth', block: 'start' })
    })
  }

  return (
    <>
      {withHeading && <h1 className={styles.title}>{t('content.title')}</h1>}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('content.corner')}</legend>
        <div className={styles.chips}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              dashed={c.id === DEFAULT_CATEGORY_ID}
              selected={chosenId === c.id}
              onClick={() => update({ category_id: c.id })}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      {wantsText && (
        <>
          {/* First, so someone who already wrote it sees this before starting to type. */}
          <DocumentImport
            content={draft.content}
            onText={(content) => {
              update({ content })
              showStory()
            }}
            onDocument={onDocument}
          />
          <TextField
            label={t('content.storyTitle')}
            optional
            maxLength={120}
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          <div className={styles.group} ref={storyRef}>
            <TextField
              label={t('content.story')}
              multiline
              rows={7}
              hint={category?.prompt_hint}
              maxLength={LIMITS.STORY_CONTENT_MAX}
              value={draft.content}
              error={errors.content}
              onChange={(e) => update({ content: e.target.value })}
            />
            <p className={styles.counter} aria-live="polite">
              {draft.content.length.toLocaleString('en-US')} /{' '}
              {LIMITS.STORY_CONTENT_MAX.toLocaleString('en-US')}
            </p>
          </div>
        </>
      )}

      {wantsPhotos && (
        <div className={styles.group}>
          <span className={styles.legend}>
            {t('content.photos')}{' '}
            {draft.kind === STORY_KIND.MIXED && (
              <span className={styles.hint}>({t('common.optional')})</span>
            )}
          </span>
          {photosLostFromDraft && <p className={styles.hint}>{t('content.photosLost')}</p>}
          <PhotoFields
            photos={photos}
            onAdd={onAddPhotos}
            onChange={onChangePhoto}
            onRemove={onRemovePhoto}
          />
          {errors.photos ? (
            <p className={styles.error}>{errors.photos}</p>
          ) : (
            photos.length > 0 && <p className={styles.hint}>{t('content.photoTip')}</p>
          )}
        </div>
      )}

      <details className={styles.details}>
        <summary>
          <span className={styles.summaryTitle}>{t('content.details')}</span>
          <span className={styles.hint}>{t('content.detailsHint')}</span>
        </summary>
        <div className={styles.detailsBody}>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('content.when')}</legend>
            <div className={styles.chips}>
              {DECADES.map((d) => (
                <Chip
                  key={d}
                  selected={draft.decade === d}
                  onClick={() => update({ decade: draft.decade === d ? null : d })}
                >
                  {t('content.decade', { d })}
                </Chip>
              ))}
            </div>
          </fieldset>
          <TextField
            label={t('content.where')}
            optional
            hint={t('content.whereHint')}
            value={draft.place}
            onChange={(e) => update({ place: e.target.value })}
          />
          <TextField
            label={t('content.who')}
            optional
            hint={t('content.namesHint')}
            value={draft.people}
            onChange={(e) => update({ people: e.target.value })}
          />
        </div>
      </details>
    </>
  )
}
