import { Link, Outlet, useLocation } from 'react-router-dom'
import { LANGS, useLang } from '../i18n/i18n.js'
import { Button } from './Button.jsx'
import styles from './Layout.module.css'

/** Switches the public site between Hebrew and English. */
function LanguageToggle() {
  const { lang, setLang, t } = useLang()
  const other = lang === LANGS.EN ? LANGS.HE : LANGS.EN
  return (
    <button
      type="button"
      className={styles.lang}
      lang={other}
      aria-label={t('lang.otherLabel')}
      onClick={() => setLang(other)}
    >
      {t('lang.other')}
    </button>
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
