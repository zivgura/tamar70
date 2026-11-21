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

/** Shares the story's address: the phone's share sheet, or copied to the clipboard. */
function ShareButton({ title }) {
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
      {copied ? 'הקישור הועתק' : 'שיתוף הסיפור'}
    </button>
  )
}

/**
 * One story. While collecting it's the sealed card and the reveal date. After the reveal:
 * the whole text, its photos (tap to enlarge) and a share button.
 */
export default function Story() {
  const { id } = useParams()
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
        <p>הסיפור הזה לא נמצא.</p>
        <Link to="/">לדף הבית</Link>
      </Message>
    )
  }

  const category = findCategory(boot.data?.categories, story.category_id)
  const birthday = boot.data?.site.birthday_date
  return (
    <div className={styles.page}>
      <Link to={category ? `/corner/${category.id}` : '/'} className={styles.back}>
        → {category?.name ?? 'לדף הבית'}
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
        <SkeletonGroup label="טוען את הסיפור המלא" className={styles.feed}>
          <Skeleton size="lg" />
          <Skeleton size="lg" />
          <Skeleton size="lg" width="2/3" />
        </SkeletonGroup>
      )}
      {story.photos?.length > 0 && <PhotoMosaic photos={story.photos} label="התמונות של הסיפור" />}
      {story.view === 'full' && <ShareButton title={story.title || 'סיפור על תמר'} />}
      {story.view === 'teaser' && birthday && (
        <Message>הסיפור המלא, עם התמונות, ייחשף ב-{formatDay(birthday)}.</Message>
      )}
    </div>
  )
}
