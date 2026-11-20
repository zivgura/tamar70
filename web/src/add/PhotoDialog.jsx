import { useEffect, useRef, useState } from 'react'
import { Button, TextField } from '../components'
import styles from './Add.module.css'

/**
 * Details for one photo: caption, approximate year and who's in it. These feed the
 * photo-identification puzzles later, so they're worth a gentle ask but never required.
 */
export function PhotoDialog({ photo, onSave, onRemove, onClose }) {
  const ref = useRef(null)
  const [values, setValues] = useState({ caption: '', year: '', people: '' })

  useEffect(() => {
    const dialog = ref.current
    if (!photo || !dialog) return
    setValues({ caption: photo.caption ?? '', year: photo.year ?? '', people: photo.people ?? '' })
    if (!dialog.open) dialog.showModal?.()
  }, [photo])

  if (!photo) return null
  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }))

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-label="פרטי התמונה">
      <form
        method="dialog"
        className={styles.dialogForm}
        onSubmit={() => onSave(photo.key, values)}
      >
        <img className={styles.dialogPhoto} src={photo.url} alt="" />
        <TextField label="כיתוב" optional value={values.caption} onChange={set('caption')} />
        <TextField
          label="שנה בערך"
          optional
          inputMode="numeric"
          dir="ltr"
          maxLength={4}
          value={values.year}
          onChange={set('year')}
        />
        <TextField
          label="מי בתמונה"
          optional
          hint="שמות, מופרדים בפסיקים"
          value={values.people}
          onChange={set('people')}
        />
        <div className={styles.dialogActions}>
          <Button type="submit">שמירה</Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() => {
              ref.current?.close()
              onRemove(photo.key)
            }}
          >
            הסרת התמונה
          </Button>
        </div>
      </form>
    </dialog>
  )
}
