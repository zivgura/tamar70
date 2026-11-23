import { Link, Outlet, useLocation } from 'react-router-dom'
import { LANGS, useLang } from '../i18n/i18n.js'
import { Button } from './Button.jsx'
import styles from './Layout.module.css'

const OPTIONS = [
  { lang: LANGS.HE, short: 'עב', name: 'עברית' },
  { lang: LANGS.EN, short: 'EN', name: 'English' },
]

/** A two-way toggle between the Hebrew and English site; the current one is filled in. */
function LanguageToggle() {
  const { lang, setLang } = useLang()
  return (
    <div className={styles.lang} role="group" aria-label="Language / שפה">
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          lang={o.lang}
          className={styles.langOption}
          aria-pressed={lang === o.lang}
          aria-label={o.name}
          onClick={() => setLang(o.lang)}
        >
          {o.short}
        </button>
      ))}
    </div>
  )
}

/** The page frame: site name, the language switch, and "Add a story" except in the add flow. */
export function Layout() {
  const { pathname } = useLocation()
  const { t } = useLang()
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          {t('site.name')}
        </Link>
        <div className={styles.tools}>
          <LanguageToggle />
          {!pathname.startsWith('/add') && (
            <Button as={Link} to="/add" variant="secondary" size="small">
              {t('common.addStory')}
            </Button>
          )}
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
