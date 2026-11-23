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
import { useLang } from '../i18n/i18n.js'

/** Before the reveal: how many photos are waiting. After: every photo, tap to enlarge. */
export default function Gallery() {
  const { lang, t } = useLang()
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
        <h1 className={styles.title}>{t('gallery.title')}</h1>
        {gallery.error ? (
          <ErrorMessage error={gallery.error} onRetry={gallery.refetch} />
        ) : gallery.isPending ? (
          <MosaicSkeleton />
        ) : gallery.data.photos.length === 0 ? (
          <Message>{t('gallery.opening')}</Message>
        ) : (
          <>
            <p className={styles.description}>
              {t('gallery.tapHint', { count: photosText(gallery.data.photos.length, lang) })}
            </p>
            <PhotoMosaic photos={gallery.data.photos} label={t('gallery.all')} />
          </>
        )}
      </div>
    )
  }

  const { photos } = data.site.stats
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('gallery.title')}</h1>
      <Polaroid className={own.polaroid} tilt="right" caption={t('gallery.soon')} handwritten />
      <Message>
        <p>
          {photos ? t('gallery.collected', { count: photosText(photos, lang) }) : t('gallery.none')}
          {t('gallery.revealOn', { date: formatDay(data.site.birthday_date, lang) })}
        </p>
      </Message>
    </div>
  )
}
