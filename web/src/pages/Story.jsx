import { Link, useParams } from 'react-router-dom'
import { findCategory, useStory } from '../api/queries.js'
import { ErrorMessage, LoadingCards, Message, StoryCard } from '../components'
import { formatDay } from '../lib/format.js'
import styles from './Corner.module.css'

/**
 * One memory. While collecting it's the sealed card and the reveal date. Once published
 * the server sends the full text, shown in the card (the magazine layout comes later).
 */
export default function Story() {
  const { id } = useParams()
  const { story, isPending, error, boot } = useStory(id)

  if (isPending) {
    return (
      <div className={styles.page}>
        <LoadingCards count={1} />
      </div>
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
      <StoryCard story={story} category={category} linked={false} full headingLevel={1} />
      {story.view === 'teaser' && birthday && (
        <Message>הסיפור המלא, עם התמונות, ייחשף ב-{formatDay(birthday)}.</Message>
      )}
    </div>
  )
}
