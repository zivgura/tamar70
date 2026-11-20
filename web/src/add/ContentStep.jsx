import { DEFAULT_CATEGORY_ID, LIMITS, STORY_KIND } from '@tamar70/shared'
import { Chip, TextField } from '../components'
import styles from './Add.module.css'
import { PhotoGrid } from './PhotoGrid.jsx'

const DECADES = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]
const decadeLabel = (d) => (d < 2000 ? `שנות ה-${String(d).slice(2)}` : `שנות ה-${d}`)

/** Step 3: the corner, the text, the photos and the optional details. */
export function ContentStep({
  draft,
  update,
  categories,
  photos,
  onAddPhotos,
  onOpenPhoto,
  errors,
  photosLostFromDraft,
  withHeading = true,
}) {
  const wantsText = draft.kind !== STORY_KIND.PHOTOS
  const wantsPhotos = draft.kind !== STORY_KIND.TEXT
  const category = categories.find((c) => c.id === (draft.category_id ?? DEFAULT_CATEGORY_ID))

  return (
    <>
      {withHeading && <h1 className={styles.title}>ספרו לנו</h1>}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>לאיזו פינה זה שייך?</legend>
        <div className={styles.chips}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              dashed={c.id === DEFAULT_CATEGORY_ID}
              selected={(draft.category_id ?? DEFAULT_CATEGORY_ID) === c.id}
              onClick={() => update({ category_id: c.id })}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      {wantsText && (
        <>
          <TextField
            label="כותרת"
            optional
            maxLength={120}
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          <div className={styles.group}>
            <TextField
              label="הסיפור"
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
            תמונות {draft.kind === STORY_KIND.MIXED && <span className={styles.hint}>(רשות)</span>}
          </span>
          {photosLostFromDraft && (
            <p className={styles.hint}>התמונות לא נשמרות בטיוטה. בחרו אותן שוב.</p>
          )}
          <PhotoGrid photos={photos} onAdd={onAddPhotos} onOpen={onOpenPhoto} />
          {errors.photos ? (
            <p className={styles.error}>{errors.photos}</p>
          ) : (
            photos.length > 0 && (
              <p className={styles.hint}>לחיצה על תמונה מוסיפה כיתוב, שנה ומי בתמונה.</p>
            )
          )}
        </div>
      )}

      <details className={styles.details}>
        <summary>
          <span className={styles.summaryTitle}>הוסיפו פרטים (רשות)</span>
          <span className={styles.hint}>עשור, מקום ואנשים שמוזכרים בסיפור</span>
        </summary>
        <div className={styles.detailsBody}>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>מתי זה היה?</legend>
            <div className={styles.chips}>
              {DECADES.map((d) => (
                <Chip
                  key={d}
                  selected={draft.decade === d}
                  onClick={() => update({ decade: draft.decade === d ? null : d })}
                >
                  {decadeLabel(d)}
                </Chip>
              ))}
            </div>
          </fieldset>
          <TextField
            label="איפה?"
            optional
            hint="מקום אחד או כמה, מופרדים בפסיקים"
            value={draft.place}
            onChange={(e) => update({ place: e.target.value })}
          />
          <TextField
            label="מי עוד מופיע בסיפור?"
            optional
            hint="שמות, מופרדים בפסיקים"
            value={draft.people}
            onChange={(e) => update({ people: e.target.value })}
          />
        </div>
      </details>
    </>
  )
}
