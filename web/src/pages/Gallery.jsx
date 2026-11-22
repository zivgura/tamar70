import { useBootstrap, useGallery } from '../api/queries.js'
import {
  ErrorMessage,
  Message,
  MosaicSkeleton,
  PhotoMosaic,
  Polaroid,
  Skeleton,
  SkeletonGroup,
} from '../components'
import { formatDay, photosText } from '../lib/format.js'
import styles from './Corner.module.css'
import own from './Gallery.module.css'

/** Before the reveal: how many photos are waiting. After: every photo, tap to enlarge. */
export default function Gallery() {
  const { data, error, isPending, refetch } = useBootstrap()
  const published = data?.site.site_status === 'published'
  const gallery = useGallery(published)

  if (error) return <ErrorMessage error={error} onRetry={refetch} />
  if (isPending) {
    return (
      <SkeletonGroup className={styles.page}>
        <Skeleton size="5xl" width="1/3" />
        <MosaicSkeleton count={6} />
      </SkeletonGroup>
    )
  }

  if (published) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>הגלריה</h1>
        {gallery.error ? (
          <ErrorMessage error={gallery.error} onRetry={gallery.refetch} />
        ) : gallery.isPending ? (
          <MosaicSkeleton />
        ) : gallery.data.photos.length === 0 ? (
          <Message>התמונות עוד נפתחות לצפייה. נסו שוב בעוד כמה דקות.</Message>
        ) : (
          <>
            <p className={styles.description}>
              {photosText(gallery.data.photos.length)}. לחצו על תמונה כדי להגדיל אותה.
            </p>
            <PhotoMosaic photos={gallery.data.photos} label="כל התמונות" />
          </>
        )}
      </div>
    )
  }

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
