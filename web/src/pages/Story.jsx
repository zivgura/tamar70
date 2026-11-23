import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCanEdit } from '../add/useMine.js'
import { findCategory, useStory } from '../api/queries.js'
import {
  ErrorMessage,
  Message,
  PhotoMosaic,
  Skeleton,
  SkeletonGroup,
  StoryCard,
  StoryCardSkeleton,
} from '../components'
import { ShareIcon } from '../components/icons.js'
import { formatDay } from '../lib/format.js'
import styles from './Corner.module.css'
import { useLang } from '../i18n/i18n.js'

/** Shares the story's address: the phone's share sheet, or copied to the clipboard. */
function ShareButton({ title }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Closing the share sheet isn't an error worth showing.
    }
  }
  return (
    <button type="button" className={styles.share} onClick={share}>
      <ShareIcon aria-hidden="true" />
      {copied ? t('story.linkCopied') : t('story.share')}
    </button>
  )
}

/**
 * One story. While collecting it's the sealed card and the reveal date. After the reveal:
 * the whole text, its photos (tap to enlarge) and a share button.
 */
export default function Story() {
  const { id } = useParams()
  const { lang, t } = useLang()
  const { story, isPending, loadingFull, error, boot } = useStory(id)
  const canEdit = useCanEdit(boot.data?.site)

  if (isPending) {
    return (
      <SkeletonGroup className={styles.page}>
        <Skeleton size="md" width="1/4" />
        <StoryCardSkeleton full />
      </SkeletonGroup>
    )
  }
  if (!story) {
    if (error && error.code !== 'not_found' && error.code !== 'validation') {
      return <ErrorMessage error={error} onRetry={boot.refetch} />
    }
    return (
      <Message>
        <p>{t('story.notFound')}</p>
        <Link to="/">{t('common.home')}</Link>
      </Message>
    )
  }

  const category = findCategory(boot.data?.categories, story.category_id)
  const birthday = boot.data?.site.birthday_date
  return (
    <div className={styles.page}>
      <Link to={category ? `/corner/${category.id}` : '/'} className={styles.back}>
        {t('common.backArrow')} {category?.name ?? t('common.home')}
      </Link>
      <StoryCard
        story={story}
        category={category}
        linked={false}
        full
        headingLevel={1}
        editable={canEdit(story.id)}
      />
      {story.view === 'full' && loadingFull && (
        <SkeletonGroup label={t('story.loadingFull')} className={styles.feed}>
          <Skeleton size="lg" />
          <Skeleton size="lg" />
          <Skeleton size="lg" width="2/3" />
        </SkeletonGroup>
      )}
      {story.photos?.length > 0 && <PhotoMosaic photos={story.photos} label={t('story.photos')} />}
      {story.view === 'full' && <ShareButton title={story.title || t('story.shareTitle')} />}
      {story.view === 'teaser' && birthday && (
        <Message>{t('story.sealedOn', { date: formatDay(birthday, lang) })}</Message>
      )}
    </div>
  )
}
