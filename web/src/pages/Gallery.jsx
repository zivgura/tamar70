import { useBootstrap } from '../api/queries.js'
import { ErrorMessage, LoadingCards, Message, Polaroid } from '../components'
import { formatDay, photosText } from '../lib/format.js'
import styles from './Corner.module.css'
import own from './Gallery.module.css'

/** Collecting mode: only how many photos there are. The mosaic comes with publishing. */
export default function Gallery() {
  const { data, error, isPending, refetch } = useBootstrap()
  if (error) return <ErrorMessage error={error} onRetry={refetch} />
  if (isPending) return <LoadingCards count={1} />

  const { photos } = data.site.stats
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>הגלריה</h1>
      <Polaroid className={own.polaroid} tilt="right" caption="עוד מעט…" handwritten />
      <Message>
        <p>
          {photos ? `כבר נאספו ${photosText(photos)}.` : 'עוד לא נאספו תמונות.'} כולן ייחשפו ב-
          {formatDay(data.site.birthday_date)}.
        </p>
      </Message>
    </div>
  )
}
