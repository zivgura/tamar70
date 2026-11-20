import { Polaroid } from '../components'
import styles from './Home.module.css'

// Placeholder until milestone 4 builds the real collecting-mode home page.
export default function Home() {
  return (
    <main className={styles.page}>
      <Polaroid className={styles.photo} caption="תמר" handwritten taped tilt="leftStrong" />
      <h1 className={styles.title}>תמר בת 70</h1>
      <p className={styles.lead}>האתר בבנייה. בקרוב נאסוף כאן סיפורים וזיכרונות.</p>
    </main>
  )
}
