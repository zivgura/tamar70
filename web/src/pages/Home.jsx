import { DEFAULT_CATEGORY_ID } from '@tamar70/shared'
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
  StoryCard,
} from '../components'
import { birthdayStart, formatDay, peopleText, photosText, storiesText } from '../lib/format.js'
import tamar440 from '../assets/images/tamar-440.webp'
import tamar660 from '../assets/images/tamar-660.webp'
import styles from './Home.module.css'

const LATEST = 10

function Counter({ stats, published = false }) {
  if (!stats.stories) return <p className={styles.counter}>היו הראשונים לשתף סיפור</p>
  if (published) {
    return (
      <p className={styles.counter}>
        <strong>{storiesText(stats.stories)}</strong>
        {stats.photos > 0 && (
          <>
            {' '}
            ו-<strong>{photosText(stats.photos)}</strong>
          </>
        )}{' '}
        מ-<strong>{peopleText(stats.contributors)}</strong>
      </p>
    )
  }
  return (
    <p className={styles.counter}>
      כבר נאספו <strong>{storiesText(stats.stories)}</strong> מ-
      <strong>{peopleText(stats.contributors)}</strong>
    </p>
  )
}

/** The home page: before the reveal a countdown and sealed stories; after it, the stories. */
export default function Home() {
  const { data, error, isPending, refetch } = useBootstrap()
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
          alt="ציור של תמר מחייכת, במשקפיים כחולים ומחרוזת פנינים"
          caption="תמר"
          handwritten
          taped
          tilt="leftStrong"
        />
        <h1 className={styles.title}>תמר בת 70</h1>
        {published ? (
          <>
            <p className={styles.lead}>
              {site.reveal_message ||
                'יום הולדת שמח, תמר! כל הסיפורים והתמונות שאספנו פתוחים עכשיו לקריאה.'}
            </p>
            <Counter stats={site.stats} published />
            <Button as={Link} to="/gallery" block>
              לכל התמונות
            </Button>
            <Button as={Link} to="/add" variant="secondary" block>
              הוסיפו סיפור
            </Button>
          </>
        ) : (
          <>
            <p className={styles.lead}>
              אוספים סיפורים ותמונות לקראת יום ההולדת.
              {site?.birthday_date && ` כל מה שתשתפו ייחשף ב-${formatDay(site.birthday_date)}.`}
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
              הוסיפו סיפור
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
              הפינות
            </h2>
            <p className={styles.sectionLead}>בחרו פינה, או פשוט כתבו, ואנחנו נסדר.</p>
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

          <section className={styles.section} aria-labelledby="latest-title">
            <h2 id="latest-title" className={styles.sectionTitle}>
              סיפורים אחרונים
            </h2>
            {isPending ? (
              <StoryFeedSkeleton className={styles.feed} />
            ) : data.stories.length === 0 ? (
              <Message>עוד אין סיפורים. הסיפור הראשון יכול להיות שלכם.</Message>
            ) : (
              <div className={styles.feed}>
                {data.stories.slice(0, LATEST).map((s) => (
                  <StoryCard
                    key={s.id}
                    story={s}
                    category={findCategory(data.categories, s.category_id)}
                    editable={canEdit(s.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
