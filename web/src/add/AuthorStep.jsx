import { TextField } from '../components'
import styles from './Add.module.css'
import { useLang } from '../i18n/i18n.js'

/** Step 2: who's writing. The name is remembered on the device for next time. */
export function AuthorStep({ author, setAuthor, errors, withHeading = true }) {
  const { t } = useLang()
  return (
    <>
      {withHeading && (
        <>
          <h1 className={styles.title}>{t('author.title')}</h1>
          <p className={styles.lead}>{t('author.lead')}</p>
        </>
      )}
      <TextField
        label={t('author.name')}
        autoComplete="name"
        maxLength={60}
        value={author.name}
        error={errors.name}
        onChange={(e) => setAuthor({ ...author, name: e.target.value })}
      />
      <TextField
        label={t('author.relation')}
        optional
        hint={t('author.relationHint')}
        maxLength={80}
        value={author.relation}
        onChange={(e) => setAuthor({ ...author, relation: e.target.value })}
      />
    </>
  )
}
