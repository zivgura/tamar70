import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { reportError } from '../lib/telemetry.js'
import { Button } from './Button.jsx'
import styles from './Status.module.css'

/** Shown instead of a page that crashed. The error is reported, the visitor gets a way out. */
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    if (!notFound) reportError(error)
  }, [error, notFound])

  return (
    <div className={styles.message} role="alert">
      <p>{notFound ? 'הדף הזה לא נמצא.' : 'משהו השתבש בדף הזה. כבר קיבלנו על זה הודעה.'}</p>
      <Button size="small" onClick={() => window.location.reload()}>
        טעינה מחדש
      </Button>
      <Link to="/">לדף הבית</Link>
    </div>
  )
}
