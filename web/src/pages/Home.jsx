import { DEFAULT_CATEGORY_ID } from '@tamar70/shared'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCanEdit } from '../add/useMine.js'
import { findCategory, useBootstrap } from '../api/queries.js'
import {
  Button,
  CornerTile,
  Countdown,
  ErrorMessage,
  CornerTilesSkeleton,
  CountdownSkeleton,
  Skeleton,
  StoryFeedSkeleton,
  Message,
  Polaroid,
  PhotoStrip,
  StoryCard,
} from '../components'
import { birthdayStart, formatDay, peopleText, photosText, storiesText } from '../lib/format.js'
import tamar440 from '../assets/images/tamar-440.webp'
import tamar660 from '../assets/images/tamar-660.webp'
import styles from './Home.module.css'
import { LANGS, useLang } from '../i18n/i18n.js'

// Stories shown at first, and added by each "טען עוד" (all are already loaded).
const PAGE = 5

function Counter({ stats, published = false }) {
  const { lang, t } = useLang()
  if (!stats.stories) return <p className={styles.counter}>{t('home.beFirst')}</p>
  const stories = storiesText(stats.stories, lang)
  const people = peopleText(stats.contributors, lang)
  if (lang === LANGS.EN) {
    return (
      <p className={styles.counter}>
        <strong>{stories}</strong>
        {published && stats.photos > 0 && (
          <>
            {' '}
            and <strong>{photosText(stats.photos, lang)}</strong>
          </>
        )}{' '}
        {published ? 'from' : 'collected so far from'} <strong>{people}</strong>
      </p>
    )
  }
  if (published) {
    return (
      <p className={styles.counter}>
        <strong>{stories}</strong>
        {stats.photos > 0 && (
          <>
            {' '}
            ו-<strong>{photosText(stats.photos, lang)}</strong>
          </>
        )}{' '}
        מ-<strong>{people}</strong>
      </p>
    )
  }
  return (
    <p className={styles.counter}>
      כבר נאספו <strong>{stories}</strong> מ-
      <strong>{people}</strong>
    </p>
  )
}

/** The home page: before the reveal a countdown and sealed stories; after it, the stories. */
export default function Home() {
  const { lang, t } = useLang()
  const { data, error, isPending, refetch } = useBootstrap()
  const [shown, setShown] = useState(PAGE)
  const site = data?.site
  const canEdit = useCanEdit(site)
  const corners = data?.categories.filter((c) => c.id !== DEFAULT_CATEGORY_ID) ?? []
  const published = site?.site_status === 'published'

  return (
    <>
      <section className={styles.hero}>
        <Polaroid
          className={styles.photo}
          src={tamar660}
          srcSet={`${tamar440} 440w, ${tamar660} 660w`}
          sizes="220px"
          priority
          alt={t('home.photoAlt')}
          caption={t('home.photoCaption')}
          handwritten
          taped
          tilt="leftStrong"
        />
        <h1 className={styles.title}>{t('site.name')}</h1>
        {published ? (
          <>
            <p className={styles.lead}>
              {/* The message set in admin is Hebrew; the English site shows its own. */}
              {(lang === LANGS.HE && site.reveal_message) || t('home.revealed')}
            </p>
            <Counter stats={site.stats} published />
            <Button as={Link} to="/gallery" block>
              {t('home.toGallery')}
            </Button>
            <Button as={Link} to="/add" variant="secondary" block>
              {t('common.addStory')}
            </Button>
          </>
        ) : (
          <>
            <p className={styles.lead}>
              {t('home.collecting')}
              {site?.birthday_date &&
                t('home.revealOn', { date: formatDay(site.birthday_date, lang) })}
            </p>
            {site ? (
              <>
                <Countdown target={birthdayStart(site.birthday_date)} />
                <Counter stats={site.stats} />
              </>
            ) : (
              <>
                <CountdownSkeleton />
                <Skeleton size="md" width="2/3" center />
              </>
            )}
            <Button as={Link} to="/add" block>
              {t('common.addStory')}
            </Button>
          </>
        )}
      </section>

      {error ? (
        <ErrorMessage error={error} onRetry={refetch} />
      ) : (
        <>
          <section className={styles.section} aria-labelledby="corners-title">
            <h2 id="corners-title" className={styles.sectionTitle}>
              {t('home.corners')}
            </h2>
            <p className={styles.sectionLead}>{t('home.cornersLead')}</p>
            {isPending ? (
              <CornerTilesSkeleton className={styles.corners} />
            ) : (
              <div className={styles.corners}>
                {corners.map((c, i) => (
                  <CornerTile
                    key={c.id}
                    category={c}
                    wide={corners.length % 2 === 1 && i === corners.length - 1}
                  />
                ))}
              </div>
            )}
          </section>

          {data?.photos?.length > 0 && (
            <section className={styles.section} aria-labelledby="photos-title">
              <div className={styles.sectionHead}>
                <h2 id="photos-title" className={styles.sectionTitle}>
                  {t('home.photos')}
                </h2>
                <Link to="/gallery" className={styles.sectionLink}>
                  {t('home.allPhotos')}
                </Link>
              </div>
              <PhotoStrip photos={data.photos} label={t('home.photos')} />
            </section>
          )}

          <section className={styles.section} aria-labelledby="latest-title">
            <h2 id="latest-title" className={styles.sectionTitle}>
              {t('home.latest')}
            </h2>
            {isPending ? (
              <StoryFeedSkeleton className={styles.feed} />
            ) : data.stories.length === 0 ? (
              <Message>{t('home.empty')}</Message>
            ) : (
              <>
                <div className={styles.feed}>
                  {data.stories.slice(0, shown).map((s) => (
                    <StoryCard
                      key={s.id}
                      story={s}
                      category={findCategory(data.categories, s.category_id)}
                      editable={canEdit(s.id)}
                    />
                  ))}
                </div>
                {data.stories.length > shown && (
                  <Button
                    variant="secondary"
                    block
                    className={styles.more}
                    onClick={() => setShown((n) => n + PAGE)}
                  >
                    {t('home.more')}
                  </Button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </>
  )
}
