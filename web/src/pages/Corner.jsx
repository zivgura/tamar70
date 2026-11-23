import { Link, useParams } from 'react-router-dom'
import { useCanEdit } from '../add/useMine.js'
import { findCategory, useBootstrap } from '../api/queries.js'
import {
  Button,
  CornerIcon,
  ErrorMessage,
  Message,
  Skeleton,
  SkeletonGroup,
  StoryCard,
  StoryCardSkeleton,
} from '../components'
import styles from './Corner.module.css'
import { useLang } from '../i18n/i18n.js'

/** One corner: its prompt, a button that opens the add flow on it, and its memories. */
export default function Corner() {
  const { slug } = useParams()
  const { t } = useLang()
  const { data, error, isPending, refetch } = useBootstrap()
  const canEdit = useCanEdit(data?.site)

  if (error) return <ErrorMessage error={error} onRetry={refetch} />
  if (isPending) {
    return (
      <SkeletonGroup className={styles.page}>
        <Skeleton size="md" width="1/4" />
        <div className={styles.heading}>
          <Skeleton shape="block" size="cornerStamp" />
          <Skeleton size="5xl" width="2/3" />
        </div>
        <Skeleton width="3/4" />
        <Skeleton shape="block" size="button" />
        <div className={styles.feed}>
          <StoryCardSkeleton />
          <StoryCardSkeleton />
        </div>
      </SkeletonGroup>
    )
  }

  const category = findCategory(data.categories, slug)
  if (!category) {
    return (
      <Message>
        <p>{t('corner.notFound')}</p>
        <Link to="/">{t('common.home')}</Link>
      </Message>
    )
  }

  const stories = data.stories.filter((s) => s.category_id === category.id)
  return (
    <div className={styles.page} data-tone={category.tone}>
      <Link to="/" className={styles.back}>
        {t('common.backArrow')} {t('corner.all')}
      </Link>
      <div className={styles.heading}>
        <span className={styles.stamp}>
          <CornerIcon id={category.id} size={34} />
        </span>
        <h1 className={styles.title}>{category.name}</h1>
      </div>
      {category.description && <p className={styles.description}>{category.description}</p>}
      {category.prompt_hint && <p className={styles.prompt}>{category.prompt_hint}</p>}
      <Button as={Link} to={`/add?corner=${category.id}`} block>
        {t('corner.addHere')}
      </Button>

      {stories.length === 0 ? (
        <Message>{t('corner.empty')}</Message>
      ) : (
        <div className={styles.feed}>
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} category={category} editable={canEdit(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
