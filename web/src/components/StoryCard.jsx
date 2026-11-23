import { Link } from 'react-router-dom'
import { attachedPhotosText, timeAgo } from '../lib/format.js'
import { storyTitle } from '../lib/storyText.js'
import { Card } from './Card.jsx'
import styles from './StoryCard.module.css'
import { useLang } from '../i18n/i18n.js'

/**
 * A memory as a card. In collecting mode it's a sealed envelope: title, the first line
 * fading out, photo count on a wax seal, and "revealed soon". `linked` makes the whole
 * card open the story page; `full` shows the whole text when the server sent it.
 */
export function StoryCard({
  story,
  category,
  linked = true,
  full = false,
  headingLevel = 3,
  editable = false,
}) {
  const { lang, t } = useLang()
  const Heading = `h${headingLevel}`
  const title = storyTitle(story, lang)
  const revealed = story.view === 'full'
  const isFull = full && revealed && story.content !== undefined
  const byline = [story.author_name, story.author_relation].filter(Boolean).join(', ')

  return (
    <Card className={styles.card} tone={category?.tone ?? 'sand'}>
      <div className={styles.head}>
        {/* Stories keep the language they were written in, whatever the page's is. */}
        <Heading className={styles.title} dir="auto">
          {linked ? (
            <Link to={`/story/${story.id}`} className={styles.link}>
              {title}
            </Link>
          ) : (
            title
          )}
        </Heading>
        <span className={styles.avatar} aria-hidden="true">
          {String(story.author_name || '?')
            .trim()
            .charAt(0)}
        </span>
      </div>

      {revealed && !full && story.cover && (
        <img className={styles.cover} src={story.cover} alt="" loading="lazy" />
      )}

      {isFull ? (
        <p className={styles.body} dir="auto">
          {story.content}
        </p>
      ) : (
        story.excerpt && (
          <p className={revealed ? styles.lead : styles.excerpt} dir="auto">
            {story.excerpt}
          </p>
        )
      )}

      {story.media_count > 0 && !full && (
        <p className={styles.photos} data-tone={category?.tone}>
          <span className={styles.seal} aria-hidden="true">
            70
          </span>
          {attachedPhotosText(story.media_count, lang)}
        </p>
      )}

      <div className={styles.meta}>
        <span>{[byline, category?.name].filter(Boolean).join(' · ')}</span>
        <span>{timeAgo(story.created_at, undefined, lang)}</span>
      </div>

      {(story.view === 'teaser' || editable) && (
        <div className={styles.foot}>
          {story.view === 'teaser' && <p className={styles.sealed}>{t('story.sealedSoon')}</p>}
          {editable && (
            <Link to={`/edit/${story.id}`} className={styles.edit}>
              {t('story.edit')}
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}
