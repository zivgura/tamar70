import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { reportError } from '../lib/telemetry.js'
import { Button } from './Button.jsx'
import styles from './Status.module.css'
import { useLang } from '../i18n/i18n.js'

/** Shown instead of a page that crashed. The error is reported, the visitor gets a way out. */
export function RouteError() {
  const { t } = useLang()
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (!notFound) reportError(error)
  }, [error, notFound])

  return (
    <div className={styles.message} role="alert">
      <p>{notFound ? t('error.pageNotFound') : t('error.pageBroken')}</p>
      <Button size="small" onClick={() => window.location.reload()}>
        {t('error.reload')}
      </Button>
      <Link to="/">{t('common.home')}</Link>
    </div>
  )
}
