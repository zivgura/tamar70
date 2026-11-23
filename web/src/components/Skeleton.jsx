import cornerStyles from './CornerTile.module.css'
import countdownStyles from './Countdown.module.css'
import mosaicStyles from './PhotoMosaic.module.css'
import stripStyles from './PhotoStrip.module.css'
import cardStyles from './Card.module.css'
import styles from './Skeleton.module.css'
import storyStyles from './StoryCard.module.css'
import { useLang } from '../i18n/i18n.js'

const cx = (...names) => names.filter(Boolean).join(' ')
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * One placeholder shape while data loads. Shapes match what replaces them, so the page
 * doesn't jump:
 * - `line`: a line of text, exactly as tall as text of `size` (sm, md, base, lg, xl, 3xl,
 *   5xl, 6xl: the --text-* sizes) and `width` long (full, 3/4, 2/3, 1/2, 1/3, 1/4).
 * - `circle`: an avatar (`size` avatar: the 44px tap size) or a seal (seal: 28px).
 * - `block`: a box of `size` tile (116px), wide (72px), unit (countdown digit), photo
 *   (square), cover (4:3), field (input), area (textarea), button (56px), choice (add tiles).
 * `center` centers it, for centered layouts like the home hero.
 */
export function Skeleton({ shape = 'line', size, width = 'full', center = false, className }) {
  const defaults = { line: 'base', circle: 'avatar', block: 'tile' }
  return (
    <span
      aria-hidden="true"
      className={cx(
        styles.skeleton,
        styles[shape],
        styles[shape + capitalize(size ?? defaults[shape])],
        shape === 'line' && styles[width === 'full' ? 'wFull' : `w${width.replace('/', '')}`],
        center && styles.center,
        className,
      )}
    />
  )
}

/** Wraps placeholders: announced once as "loading" to screen readers. */
export function SkeletonGroup({ label, className, children }) {
  const { t } = useLang()
  return (
    <div
      className={className}
      role="status"
      aria-label={label ?? t('common.loading')}
      aria-busy="true"
    >
      {children}
    </div>
  )
}

/** A StoryCard while it loads: the same card, title, avatar, lines and footer. */
export function StoryCardSkeleton({ full = false }) {
  return (
    <div className={cx(cardStyles.card, storyStyles.card)}>
      <div className={storyStyles.head}>
        <Skeleton size="xl" width="2/3" />
        <Skeleton shape="circle" />
      </div>
      {full ? (
        <>
          <Skeleton size="lg" />
          <Skeleton size="lg" />
          <Skeleton size="lg" />
          <Skeleton size="lg" width="2/3" />
        </>
      ) : (
        <>
          <Skeleton />
          <Skeleton width="3/4" />
        </>
      )}
      <div className={storyStyles.meta}>
        <Skeleton size="sm" width="1/2" />
        <Skeleton size="sm" width="1/4" />
      </div>
    </div>
  )
}

/** A list of story cards loading (home, corner pages). */
export function StoryFeedSkeleton({ count = 2, className }) {
  return (
    <SkeletonGroup className={className}>
      {Array.from({ length: count }, (_, i) => (
        <StoryCardSkeleton key={i} />
      ))}
    </SkeletonGroup>
  )
}

/** The corners grid loading: postcards with a stamp and a name; an odd last one is wide. */
export function CornerTilesSkeleton({ count = 7, className }) {
  const { t } = useLang()
  return (
    <SkeletonGroup label={t('loading.corners')} className={className}>
      {Array.from({ length: count }, (_, i) => {
        const wide = count % 2 === 1 && i === count - 1
        return (
          <div key={i} className={cx(cornerStyles.tile, wide && cornerStyles.wide)}>
            <Skeleton shape="block" size="stamp" />
            <Skeleton width={wide ? '1/3' : '2/3'} />
          </div>
        )
      })}
    </SkeletonGroup>
  )
}

/** The countdown loading: three digit boxes. */
export function CountdownSkeleton() {
  return (
    <SkeletonGroup className={countdownStyles.countdown}>
      {[0, 1, 2].map((i) => (
        <div key={i} className={countdownStyles.unit}>
          <Skeleton size="sm" width="1/2" center />
          <Skeleton size="4xl" width="1/3" center />
        </div>
      ))}
    </SkeletonGroup>
  )
}

/** A form loading: a title, a lead line, fields with their labels, and the main button. */
export function FormSkeleton({ fields = 2, className }) {
  return (
    <SkeletonGroup className={className}>
      <div className={styles.form}>
        <Skeleton size="4xl" width="1/2" />
        <Skeleton width="3/4" />
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className={styles.field}>
            <Skeleton size="md" width="1/4" />
            <Skeleton shape="block" size={i === fields - 1 ? 'area' : 'field'} />
          </div>
        ))}
        <Skeleton shape="block" size="button" />
      </div>
    </SkeletonGroup>
  )
}

/** Generic placeholder cards (admin lists and other plain stacks). */
export function CardsSkeleton({ count = 2 }) {
  return (
    <SkeletonGroup className={styles.stack}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cx(cardStyles.card, styles.cardBody)}>
          <Skeleton size="lg" width="2/3" />
          <Skeleton size="sm" width="1/2" />
          <Skeleton size="sm" width="1/3" />
        </div>
      ))}
    </SkeletonGroup>
  )
}

/** The home page's photo strip loading: the same frames, in the same row. */
export function PhotoStripSkeleton({ count = 3 }) {
  const { t } = useLang()
  return (
    <SkeletonGroup label={t('loading.photos')} className={stripStyles.list}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={cx(stripStyles.item, stripStyles.frame)}>
          <Skeleton shape="block" size="photo" />
          <Skeleton size="sm" width="2/3" center />
        </span>
      ))}
    </SkeletonGroup>
  )
}

/** A grid of photos loading, in the gallery's own grid. */
export function MosaicSkeleton({ count = 9 }) {
  const { t } = useLang()
  return (
    <SkeletonGroup label={t('loading.photos')} className={mosaicStyles.mosaic}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} shape="block" size="photo" />
      ))}
    </SkeletonGroup>
  )
}
