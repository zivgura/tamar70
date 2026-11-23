import { ACTIONS } from '@tamar70/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import tamar660 from '../assets/images/tamar-660.webp'
import { Button, CardsSkeleton, CornerIcon, ErrorMessage, Message, Polaroid } from '../components'
import { peopleText, photosText, storiesText } from '../lib/format.js'
import { storyTitle } from '../lib/storyText.js'
import { useAdmin } from './adminContext.js'
import { ALBUM, bookChapters } from './bookChapters.js'
import styles from './Book.module.css'

// The story book: every story on its own page, with its photos as polaroids, grouped by
// corner behind a title page for each. Built here in the browser and printed (or saved as a
// PDF) from the browser's print window, so it keeps the site's fonts and look.

// On a story's page: one big photo and up to this many small ones; the rest follow on
// photo pages of their own.
const SMALL_ON_STORY_PAGE = 3
const PER_PHOTO_PAGE = 6

const day = (iso) =>
  iso
    ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'long', timeZone: 'Asia/Jerusalem' }).format(
        new Date(iso),
      )
    : ''

const decadeText = (d) => (d < 2000 ? `שנות ה-${String(d).slice(2)}` : `שנות ה-${d}`)

const chunks = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  )

/** The album's photos, each signed with who sent it when it has no caption of its own. */
function albumPhotos(stories) {
  return stories.flatMap((s) =>
    s.photos
      .filter((p) => p.image)
      .map((p) => ({ ...p, caption: p.caption || `מאת ${s.author_name}` })),
  )
}

function AlbumPages({ stories }) {
  return chunks(albumPhotos(stories), PER_PHOTO_PAGE).map((group, page) => (
    <section key={page} className={`${styles.page} ${styles.photoPage}`} data-tone={ALBUM.tone}>
      <p className={styles.storyCorner}>
        <CornerIcon id={ALBUM.id} size={16} />
        {ALBUM.name}
      </p>
      <div className={styles.photoGrid}>
        {group.map((p, i) => (
          <BookPhoto key={`${i}-${p.link}`} photo={p} index={i} />
        ))}
      </div>
    </section>
  ))
}

const TILTS = ['left', 'right', 'none']

function BookPhoto({ photo, index, big = false }) {
  return (
    <Polaroid
      className={big ? styles.bigPhoto : styles.smallPhoto}
      src={photo.image}
      alt={photo.caption || ''}
      caption={photo.caption || (photo.year_approx ? String(photo.year_approx) : undefined)}
      handwritten
      taped={big}
      tilt={big ? 'leftStrong' : TILTS[index % TILTS.length]}
      priority
    />
  )
}

function Cover({ stories }) {
  const people = new Set(stories.map((s) => String(s.author_name).trim())).size
  return (
    <section className={`${styles.page} ${styles.full} ${styles.cover}`}>
      <Polaroid
        className={styles.coverPhoto}
        src={tamar660}
        alt="תמר"
        caption="תמר"
        handwritten
        taped
        tilt="leftStrong"
        priority
      />
      <h1 className={styles.coverTitle}>תמר בת 70</h1>
      <p className={styles.coverSub}>ספר הסיפורים</p>
      <p className={styles.coverMeta}>
        {storiesText(stories.length)} מ-{peopleText(people)}
      </p>
    </section>
  )
}

function Contents({ chapters }) {
  return (
    <section className={`${styles.page} ${styles.contents}`}>
      <h2 className={styles.contentsTitle}>מה בספר</h2>
      <ol className={styles.contentsList}>
        {chapters.map(({ category, stories }) => (
          <li key={category.id} data-tone={category.tone}>
            <span className={styles.contentsStamp}>
              <CornerIcon id={category.id} size={22} />
            </span>
            <span className={styles.contentsName}>{category.name}</span>
            <span className={styles.contentsCount}>
              {category.id === ALBUM.id
                ? photosText(albumPhotos(stories).length)
                : storiesText(stories.length)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ChapterPage({ category, count, album = false }) {
  return (
    <section
      className={`${styles.page} ${styles.full} ${styles.chapter}`}
      data-tone={category.tone}
    >
      <span className={styles.chapterStamp}>
        <CornerIcon id={category.id} size={96} />
      </span>
      <h2 className={styles.chapterTitle}>{category.name}</h2>
      {category.description && <p className={styles.chapterText}>{category.description}</p>}
      <p className={styles.chapterCount}>{album ? photosText(count) : storiesText(count)}</p>
    </section>
  )
}

function StoryPages({ story, category }) {
  const photos = story.photos.filter((p) => p.image)
  const [big, ...rest] = photos
  const small = rest.slice(0, SMALL_ON_STORY_PAGE)
  const more = chunks(rest.slice(SMALL_ON_STORY_PAGE), PER_PHOTO_PAGE)
  const title = storyTitle(story)
  const byline = [story.author_name, story.author_relation].filter(Boolean).join(', ')
  const details = [
    day(story.created_at),
    story.decade ? decadeText(story.decade) : '',
    (story.places ?? []).join(', '),
  ].filter(Boolean)

  return (
    <>
      <article className={`${styles.page} ${styles.story}`} data-tone={category.tone}>
        <p className={styles.storyCorner}>
          <CornerIcon id={category.id} size={16} />
          {category.name}
        </p>
        <h3 className={styles.storyTitle} dir="auto">
          {title}
        </h3>
        <p className={styles.byline}>
          <bdi>{byline}</bdi>
        </p>
        {details.length > 0 && <p className={styles.details}>{details.join(' · ')}</p>}
        {story.content && (
          <p className={styles.text} dir="auto">
            {story.content}
          </p>
        )}
        {big && (
          <div className={styles.photos}>
            <BookPhoto photo={big} index={0} big />
            {small.length > 0 && (
              <div className={styles.smallRow}>
                {small.map((p, i) => (
                  <BookPhoto key={`${i}-${p.link}`} photo={p} index={i + 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </article>
      {more.map((group, page) => (
        <section
          key={page}
          className={`${styles.page} ${styles.photoPage}`}
          data-tone={category.tone}
        >
          <p className={styles.storyCorner}>
            <CornerIcon id={category.id} size={16} />
            <bdi>{title}</bdi> · עוד תמונות
          </p>
          <div className={styles.photoGrid}>
            {group.map((p, i) => (
              <BookPhoto key={`${i}-${p.link}`} photo={p} index={i} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

/** Counts the book's pictures as they load, so printing waits for them. */
function useImagesReady(rootRef, deps) {
  const [state, setState] = useState({ loaded: 0, total: 0 })
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const images = [...root.querySelectorAll('img')]
    const count = () =>
      setState({ loaded: images.filter((img) => img.complete).length, total: images.length })
    images.forEach((img) => {
      img.addEventListener('load', count)
      img.addEventListener('error', count)
    })
    count()
    return () =>
      images.forEach((img) => {
        img.removeEventListener('load', count)
        img.removeEventListener('error', count)
      })
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}

/** /admin/book: the story book, ready to print or save as a PDF. */
export default function Book() {
  const { token, call } = useAdmin()
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['admin', 'export', token],
    queryFn: () => call(ACTIONS.ADMIN_EXPORT),
    staleTime: 60_000,
    retry: false,
  })
  const chapters = useMemo(() => (data ? bookChapters(data) : []), [data])
  const bookRef = useRef(null)
  const images = useImagesReady(bookRef, [chapters])
  const ready = images.loaded >= images.total

  if (isPending) return <CardsSkeleton count={2} />
  if (error) return <ErrorMessage error={error} onRetry={refetch} />
  if (chapters.length === 0) {
    return (
      <Message>
        <p>עוד אין סיפורים לספר.</p>
        <Link to="/admin/settings">חזרה להגדרות</Link>
      </Message>
    )
  }

  const stories = chapters.flatMap((c) => c.stories)
  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <h1 className={styles.toolbarTitle}>ספר הסיפורים</h1>
        <p className={styles.toolbarText}>
          כל סיפור בעמוד משלו עם התמונות שלו, לפי הפינות. לחצו על הכפתור, ובחלון ההדפסה בחרו
          &quot;שמירה כ-PDF&quot; (או מדפסת). הכי טוב ממחשב, ב-Chrome.
        </p>
        <Button onClick={() => window.print()} disabled={!ready}>
          {ready ? 'הדפסה / שמירה כ-PDF' : `טוענים תמונות (${images.loaded} מתוך ${images.total})`}
        </Button>
      </div>
      <div ref={bookRef} className={styles.book}>
        <Cover stories={stories} />
        <Contents chapters={chapters} />
        {chapters.map(({ category, stories: list, album }) => (
          <div key={category.id} className={styles.chapterGroup}>
            <ChapterPage
              category={category}
              count={album ? albumPhotos(list).length : list.length}
              album={album}
            />
            {album ? (
              <AlbumPages stories={list} />
            ) : (
              list.map((story) => <StoryPages key={story.id} story={story} category={category} />)
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
