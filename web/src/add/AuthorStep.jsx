import { TextField } from '../components'
import styles from './Add.module.css'

/** Step 3: who's writing, and the consent line. */
export function AuthorStep({ author, setAuthor, errors }) {
  return (
    <>
      <h1 className={styles.title}>מי כותב?</h1>
      <TextField
        label="השם שלכם"
        autoComplete="name"
        maxLength={60}
        value={author.name}
        error={errors.name}
        onChange={(e) => setAuthor({ ...author, name: e.target.value })}
      />
      <TextField
        label="איך אתם מכירים את תמר?"
        optional
        hint="למשל: חברה מהצבא, אחיין, שכנה מהבניין"
        maxLength={80}
        value={author.relation}
        onChange={(e) => setAuthor({ ...author, relation: e.target.value })}
      />
      <p className={styles.consent}>
        הסיפור והתמונות יהיו גלויים לכל מי שיש לו את קישור האתר, ועשויים לשמש במשחק משפחתי ליום
        ההולדת.
      </p>
    </>
  )
}
