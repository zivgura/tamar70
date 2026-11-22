import { STORY_STATUS } from '@tamar70/shared'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Chip, ErrorMessage, CardsSkeleton, Message } from '../components'
import { photosText } from '../lib/format.js'
import styles from './Admin.module.css'
import { formatDateTime, storyState } from './adminFormat.js'
import { StateBadge } from './StateBadge.jsx'
import { useAdminStories } from './adminQueries.js'

const FILTERS = [
  { id: 'shown', label: 'באתר', test: (s) => ['shown', 'early'].includes(storyState(s)) },
  { id: 'hidden', label: 'מוסתרים', test: (s) => storyState(s) === 'hidden' },
  { id: 'deleted', label: 'נמחקו', test: (s) => storyState(s) === 'deleted' },
  { id: 'all', label: 'הכל', test: () => true },
]

/** /admin: every story that came in, newest first. */
export default function AdminStories() {
  const { data, isPending, error, refetch } = useAdminStories()
  const [filter, setFilter] = useState('shown')

  if (isPending) return <CardsSkeleton count={4} />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />

  const names = Object.fromEntries(data.categories.map((c) => [c.id, c.name]))
  const active = FILTERS.find((f) => f.id === filter)
  const stories = data.stories.filter(active.test)
  const live = data.stories.filter((s) => s.status === STORY_STATUS.ACTIVE)
  const photos = live.reduce((n, s) => n + (s.media_count || 0), 0)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>הסיפורים</h1>
      <p className={styles.lead}>
        {live.length} סיפורים · {photos} תמונות ·{' '}
        {data.site_status === 'published' ? 'האתר פורסם' : 'שלב האיסוף'}
      </p>

      <div className={styles.filters} role="group" aria-label="סינון">
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} ({data.stories.filter(f.test).length})
          </Chip>
        ))}
      </div>

      {stories.length === 0 ? (
        <Message>אין כאן סיפורים.</Message>
      ) : (
        <ul className={styles.list}>
          {stories.map((s) => (
            <li key={s.id}>
              <Link to={`/admin/story/${s.id}`} className={styles.row}>
                <span className={styles.rowTop}>
                  <span className={styles.rowTitle}>{s.title || s.excerpt || 'בלי כותרת'}</span>
                  <StateBadge story={s} />
                </span>
                {s.title && s.excerpt && <span className={styles.rowExcerpt}>{s.excerpt}</span>}
                <span className={styles.rowMeta}>
                  {s.author_name}
                  {s.author_relation ? ` (${s.author_relation})` : ''} ·{' '}
                  {names[s.category_id] ?? 'כללי'}
                  {s.media_count ? ` · ${photosText(s.media_count)}` : ''}
                </span>
                <span className={styles.rowMeta}>{formatDateTime(s.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
