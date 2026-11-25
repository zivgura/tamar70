import { MAX_PHOTOS_PER_STORY } from '@tamar70/shared'
import { useState } from 'react'
import { rejectMessage } from '../api/messages.js'
import { TextField } from '../components'
import { CloseIcon, PlusIcon } from '../components/icons.js'
import { useLang } from '../i18n/i18n.js'
import { isBadYear } from '../lib/photoYear.js'
import styles from './Add.module.css'

/**
 * One photo with its optional details right under it: a name, a year and who is in it.
 * These feed the photo puzzles in the escape room later, so they are worth a gentle ask.
 */
function PhotoCard({ photo, onChange, onRemove }) {
  const { lang, t } = useLang()
  const [showPeople, setShowPeople] = useState(Boolean(photo.people))
  const set = (field) => (e) => onChange(photo.key, { [field]: e.target.value })

  return (
    <li className={styles.photoCard}>
      <div className={styles.photoCardImage}>
        {photo.url ? (
          <img className={styles.photoCardThumb} src={photo.url} alt="" />
        ) : (
          <span className={styles.photoCardThumb} />
        )}
        <button
          type="button"
          className={styles.photoRemove}
          aria-label={t('photo.removeNamed', { name: photo.name })}
          onClick={() => onRemove(photo.key)}
        >
          <CloseIcon aria-hidden="true" />
        </button>
      </div>
      <div className={styles.photoCardFields}>
        {photo.rejected && <p className={styles.error}>{rejectMessage(photo.rejected, lang)}</p>}
        <div className={styles.photoNameYear}>
          <div className={styles.photoName}>
            <TextField
              label={t('photo.name')}
              placeholder={t('photo.namePlaceholder')}
              maxLength={200}
              value={photo.caption ?? ''}
              onChange={set('caption')}
            />
          </div>
          <div className={styles.photoYear}>
            <TextField
              label={t('photo.yearShort')}
              inputMode="numeric"
              dir="ltr"
              maxLength={4}
              placeholder="1975"
              value={photo.year ?? ''}
              error={isBadYear(photo.year) ? t('photo.yearInvalid') : undefined}
              onChange={set('year')}
            />
          </div>
        </div>
        {showPeople ? (
          <TextField
            label={t('photo.people')}
            hint={t('content.namesHint')}
            value={photo.people ?? ''}
            onChange={set('people')}
          />
        ) : (
          <button
            type="button"
            className={styles.photoAddPeople}
            onClick={() => setShowPeople(true)}
          >
            <PlusIcon aria-hidden="true" />
            {t('photo.people')}
          </button>
        )}
      </div>
    </li>
  )
}

/** The photos being added, each with its own fields, and the button to add more. */
export function PhotoFields({ photos, onAdd, onChange, onRemove }) {
  const { t } = useLang()
  const room = MAX_PHOTOS_PER_STORY - photos.length
  return (
    <div className={styles.photoFields}>
      {photos.length > 0 && (
        <ul className={styles.photoCards}>
          {photos.map((photo) => (
            <PhotoCard key={photo.key} photo={photo} onChange={onChange} onRemove={onRemove} />
          ))}
        </ul>
      )}
      {room > 0 && (
        <label className={styles.addPhotoWide}>
          <PlusIcon aria-hidden="true" />
          {t('photo.add')}
          <input
            className="visually-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              onAdd(Array.from(e.target.files).slice(0, room))
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}
