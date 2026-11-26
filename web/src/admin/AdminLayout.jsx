import { ACTIONS, GOOGLE_CLIENT_ID } from '@tamar70/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { apiCall } from '../api/client.js'
import { LANGS } from '../i18n/i18n.js'
import { LanguageProvider } from '../i18n/language.jsx'
import { Button, ErrorMessage, Message } from '../components'
import styles from './Admin.module.css'
import { AdminContext } from './adminContext.js'
import { useAdminPrefetch } from './adminQueries.js'
import { loadGoogleIdentity } from './googleSignIn.js'
import { clearToken, loadToken, readClaims, saveToken } from './session.js'

/** The "Sign in with Google" button, drawn by Google's own library. */
function SignIn({ onToken, note }) {
  const buttonRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadGoogleIdentity()
      .then((gis) => {
        if (cancelled || !buttonRef.current) return
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onToken(response.credential),
          auto_select: true,
          ux_mode: 'popup',
        })
        gis.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'he',
        })
        gis.prompt()
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [onToken])

  return (
    <div className={styles.signIn}>
      <h1 className={styles.title}>ניהול האתר</h1>
      <p className={styles.lead}>{note ?? 'הכניסה למנהלות בלבד, עם חשבון Google.'}</p>
      <div ref={buttonRef} className={styles.googleButton} />
      {failed && (
        <p className={styles.error} role="alert">
          לא הצלחנו לטעון את הכניסה עם Google. בדקו את החיבור ורעננו את הדף.
        </p>
      )}
    </div>
  )
}

const TABS = [
  // A story's page belongs to the stories tab.
  {
    to: '/admin',
    label: 'הסיפורים',
    match: (path) => path === '/admin' || path.startsWith('/admin/story'),
  },
  { to: '/admin/stats', label: 'נתונים' },
  { to: '/admin/game', label: 'חדר בריחה' },
  { to: '/admin/settings', label: 'הגדרות' },
]

function AdminTabs() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '')
  return (
    <nav className={styles.tabs} aria-label="אזורי הניהול">
      {TABS.map((tab) => {
        const active = tab.match ? tab.match(path) : path.startsWith(tab.to)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={styles.tab}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * /admin: Google sign-in, then the admin pages. The server checks the token and the
 * AdminUsers list on every call; this screen only decides what to show.
 */
/** Admin pages are Hebrew only, whatever language the public site is in. */
export default function AdminLayout() {
  return (
    <LanguageProvider force={LANGS.HE}>
      <AdminShell />
    </LanguageProvider>
  )
}

/** Loads every tab's data in the background once the sign-in is confirmed. */
function AdminPrefetch() {
  useAdminPrefetch(true)
  return null
}

function AdminShell() {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(loadToken)
  const [expired, setExpired] = useState(false)

  const signIn = useCallback((credential) => {
    saveToken(credential)
    setExpired(false)
    setToken(credential)
  }, [])

  const signOut = useCallback(
    ({ expired: wasExpired = false } = {}) => {
      clearToken()
      queryClient.removeQueries({ queryKey: ['admin'] })
      if (!wasExpired) window.google?.accounts?.id?.disableAutoSelect?.()
      setExpired(wasExpired)
      setToken(null)
    },
    [queryClient],
  )

  const call = useCallback(
    async (action, payload = {}) => {
      try {
        return await apiCall(action, { ...payload, id_token: token })
      } catch (err) {
        if (err.code === 'sign_in_required') signOut({ expired: true })
        throw err
      }
    },
    [token, signOut],
  )

  const me = useQuery({
    queryKey: ['admin', 'me', token],
    queryFn: () => call(ACTIONS.ADMIN_ME),
    enabled: Boolean(token),
    staleTime: Infinity,
    retry: false,
  })

  const value = useMemo(() => ({ token, me: me.data, call }), [token, me.data, call])

  let content
  if (!token) {
    content = (
      <SignIn onToken={signIn} note={expired ? 'הכניסה פגה. היכנסו שוב כדי להמשיך.' : null} />
    )
  } else if (me.error?.code === 'not_admin') {
    content = (
      <Message>
        <p>החשבון {readClaims(token)?.email} לא ברשימת המנהלות.</p>
        <Button variant="quiet" size="small" onClick={() => signOut()}>
          כניסה עם חשבון אחר
        </Button>
      </Message>
    )
  } else if (me.error) {
    content = <ErrorMessage error={me.error} onRetry={me.refetch} />
  } else {
    // The page loads its data while the sign-in is being checked, not after: the server
    // checks the sign-in on every call anyway.
    content = <Outlet />
  }

  return (
    <AdminContext.Provider value={value}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link to="/admin" className={styles.brand}>
            ניהול · תמר בת 70
          </Link>
          <nav className={styles.headerLinks} aria-label="קישורים">
            <Link to="/">לאתר</Link>
            {token && (
              <button type="button" className={styles.linkButton} onClick={() => signOut()}>
                יציאה
              </button>
            )}
          </nav>
        </header>
        {me.isSuccess && <AdminPrefetch />}
        {token && <AdminTabs />}
        <main className={styles.main}>{content}</main>
      </div>
    </AdminContext.Provider>
  )
}
