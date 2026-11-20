import { Link, useParams } from 'react-router-dom'
import { useCanEdit } from '../add/useMine.js'
import { findCategory, useBootstrap } from '../api/queries.js'
import { Button, CornerIcon, ErrorMessage, LoadingCards, Message, StoryCard } from '../components'
import styles from './Corner.module.css'

/** One corner: its prompt, a button that opens the add flow on it, and its memories. */
export default function Corner() {
  const { slug } = useParams()
  const { data, error, isPending, refetch } = useBootstrap()
  const canEdit = useCanEdit(data?.site)

  if (error) return <ErrorMessage error={error} onRetry={refetch} />
  if (isPending) {
    return (
      <div className={styles.page}>
        <LoadingCards />
      </div>
    )
  }

  const category = findCategory(data.categories, slug)
  if (!category) {
    return (
      <Message>
        <p>הפינה הזו לא קיימת.</p>
        <Link to="/">לדף הבית</Link>
      </Message>
    )
  }

  const stories = data.stories.filter((s) => s.category_id === category.id)
  return (
    <div className={styles.page} data-tone={category.tone}>
      <Link to="/" className={styles.back}>
        → כל הפינות
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
        הוסיפו סיפור לפינה הזו
      </Button>

      {stories.length === 0 ? (
        <Message>עוד אין סיפורים בפינה הזו. היו הראשונים.</Message>
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
