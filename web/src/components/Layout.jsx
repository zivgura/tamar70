import { Link, Outlet, useLocation } from 'react-router-dom'
import { Button } from './Button.jsx'
import styles from './Layout.module.css'

/** The page frame: site name, and "Add a memory" on every screen except the add flow. */
export function Layout() {
  const { pathname } = useLocation()
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          תמר בת 70
        </Link>
        {!pathname.startsWith('/add') && (
          <Button as={Link} to="/add" variant="secondary" size="small">
            הוסיפו זיכרון
          </Button>
        )}
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
