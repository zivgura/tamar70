import { TextField } from '../components'
import styles from './Add.module.css'

/** Step 2: who's writing. The name is remembered on the device for next time. */
export function AuthorStep({ author, setAuthor, errors, withHeading = true }) {
  return (
    <>
      {withHeading && (
        <>
          <h1 className={styles.title}>מי כותב?</h1>
          <p className={styles.lead}>כדי שכולם ידעו ממי הסיפור.</p>
        </>
      )}
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
    </>
  )
}
