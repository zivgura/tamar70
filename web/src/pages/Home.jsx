import { DEFAULT_CATEGORY_ID } from '@tamar70/shared'
import { Link } from 'react-router-dom'
import { useCanEdit } from '../add/useMine.js'
import { findCategory, useBootstrap } from '../api/queries.js'
import {
  Button,
  CornerTile,
  Countdown,
  ErrorMessage,
  LoadingCards,
  Message,
  Polaroid,
  StoryCard,
} from '../components'
import { birthdayStart, formatDay, storiesText, peopleText } from '../lib/format.js'
import styles from './Home.module.css'

const LATEST = 10

function Counter({ stats }) {
  if (!stats.stories) return <p className={styles.counter}>היו הראשונים לשתף סיפור</p>
  return (
    <p className={styles.counter}>
      כבר נאספו <strong>{storiesText(stats.stories)}</strong> מ-
      <strong>{peopleText(stats.contributors)}</strong>
    </p>
  )
}

/** Collecting-mode home: polaroid, countdown, counter, corners, latest sealed memories. */
export default function Home() {
  const { data, error, isPending, refetch } = useBootstrap()
  const site = data?.site
  const canEdit = useCanEdit(site)
  const corners = data?.categories.filter((c) => c.id !== DEFAULT_CATEGORY_ID) ?? []

  return (
    <>
      <section className={styles.hero}>
        <Polaroid className={styles.photo} caption="תמר" handwritten taped tilt="leftStrong" />
        <h1 className={styles.title}>תמר בת 70</h1>
        <p className={styles.lead}>
          אוספים סיפורים ותמונות לקראת יום ההולדת.
          {site?.birthday_date && ` כל מה שתשתפו ייחשף ב-${formatDay(site.birthday_date)}.`}
        </p>
        {site && <Countdown target={birthdayStart(site.birthday_date)} />}
        {site && <Counter stats={site.stats} />}
        <Button as={Link} to="/add" block>
          הוסיפו סיפור
        </Button>
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
              <LoadingCards count={1} />
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
              <LoadingCards />
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
