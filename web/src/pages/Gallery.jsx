import { useGallery } from '../api/queries.js'
import {
  ErrorMessage,
  Message,
  MosaicSkeleton,
  PhotoMosaic,
  Polaroid,
  Skeleton,
  SkeletonGroup,
} from '../components'
import { useLang } from '../i18n/i18n.js'
import { photosText } from '../lib/format.js'
import styles from './Corner.module.css'
import own from './Gallery.module.css'

/** Every photo on the site, newest stories first; tap one to enlarge it. */
export default function Gallery() {
  const { lang, t } = useLang()
  const gallery = useGallery()

  if (gallery.isPending) {
    return (
      <SkeletonGroup className={styles.page}>
        <Skeleton size="5xl" width="1/3" />
        <MosaicSkeleton count={6} />
      </SkeletonGroup>
    )
  }

  const photos = gallery.data?.photos ?? []
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('gallery.title')}</h1>
      {gallery.error ? (
        <ErrorMessage error={gallery.error} onRetry={gallery.refetch} />
      ) : photos.length === 0 ? (
        <>
          <Polaroid className={own.polaroid} tilt="right" caption={t('gallery.soon')} handwritten />
          <Message>{t('gallery.none')}</Message>
        </>
      ) : (
        <>
          <p className={styles.description}>
            {t('gallery.tapHint', { count: photosText(photos.length, lang) })}
          </p>
          <PhotoMosaic photos={photos} label={t('gallery.all')} />
        </>
      )}
    </div>
  )
}
