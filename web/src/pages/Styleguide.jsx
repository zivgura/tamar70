import { CATEGORY_TONES } from '@tamar70/shared'
import { Button, Card, Chip, CornerTile, Polaroid, ProgressBar, TextField } from '../components'
import styles from './Styleguide.module.css'

// A living reference of the design system, at /_styleguide (not linked from the site).
// Every value shown comes from web/src/theme/tokens.css.

const COLORS = [
  '--color-bg',
  '--color-surface',
  '--color-surface-sunken',
  '--color-border',
  '--color-border-strong',
  '--color-text',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-subtle',
  '--color-selected-bg',
  '--color-success',
  '--color-danger',
  '--color-tape',
]

const TEXT_SIZES = ['xs', 'sm', 'md', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']
const RADII = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full']
const SHADOWS = ['card', 'photo', 'photo-lifted']
const TONE_NAMES = { rose: 'ורוד עתיק', sage: 'ירוק מרווה', terracotta: 'טרקוטה', sand: 'חול' }

const CORNERS = [
  ['journey', 'מסע בזמן', 'rose'],
  ['protest', 'תקופת המחאה', 'sage'],
  ['travels', 'טיולים בארץ ובעולם', 'sage'],
  ['sayings', 'המשפטים של תמר', 'rose'],
  ['fun-fact', 'עובדה מעניינת על תמר', 'rose'],
  ['did-you-know', 'לא ידעתם על תמר', 'sage'],
  ['wishes', 'כמה מילים לתמר', 'rose'],
  ['general', 'לא בטוחים – כללי', 'sand'],
]

const tokenVar = (name) => ({ '--swatch': `var(${name})` })

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export default function Styleguide() {
  return (
    <main className={styles.page}>
      <h1>מערכת העיצוב</h1>
      <p className={styles.intro}>
        כל הצבעים, הגופנים והמידות מגיעים מקובץ אחד: web/src/theme/tokens.css
      </p>

      <Section title="צבעים">
        <div className={styles.grid}>
          {COLORS.map((name) => (
            <div key={name} className={styles.swatch}>
              <div className={styles.chipSample} style={tokenVar(name)} />
              <div className={styles.swatchLabel}>{name}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="גוונים של פינות">
        <div className={styles.grid}>
          {CATEGORY_TONES.map((tone) => (
            <div key={tone} className={styles.tone} data-tone={tone}>
              {TONE_NAMES[tone]}
              <span className={styles.swatchLabel}>data-tone=&quot;{tone}&quot;</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="אייקונים של הפינות">
        <div className={styles.grid}>
          {CORNERS.map(([id, name, tone]) => (
            <CornerTile key={id} category={{ id, name, tone }} />
          ))}
        </div>
      </Section>

      <Section title="טיפוגרפיה">
        <p className={`${styles.typeRow} ${styles.display}`}>
          <span className={styles.typeToken}>--font-display</span>
          <span className={styles.typeSample} style={tokenVar('--text-3xl')}>
            Frank Ruhl Libre · תמר בת 70
          </span>
        </p>
        <p className={styles.typeRow}>
          <span className={styles.typeToken}>--font-body</span>
          <span className={styles.typeSample} style={tokenVar('--text-xl')}>
            Assistant · אוספים סיפורים וזיכרונות
          </span>
        </p>
        <p className={`${styles.typeRow} ${styles.hand}`}>
          <span className={styles.typeToken}>--font-hand</span>
          <span className={styles.typeSample} style={tokenVar('--text-hand')}>
            Amatic SC · תמר
          </span>
        </p>
        {TEXT_SIZES.map((size) => (
          <p key={size} className={styles.typeRow}>
            <span className={styles.typeToken}>--text-{size}</span>
            <span className={styles.typeSample} style={tokenVar(`--text-${size}`)}>
              הטרמפ לאילת
            </span>
          </p>
        ))}
      </Section>

      <Section title="פינות ועומק">
        <div className={styles.row}>
          {RADII.map((r) => (
            <div
              key={r}
              className={`${styles.box} ${styles.radius}`}
              style={tokenVar(`--radius-${r}`)}
            >
              --radius-{r}
            </div>
          ))}
        </div>
        <div className={styles.row}>
          {SHADOWS.map((s) => (
            <div
              key={s}
              className={`${styles.box} ${styles.shadow}`}
              style={tokenVar(`--shadow-${s}`)}
            >
              --shadow-{s}
            </div>
          ))}
        </div>
      </Section>

      <Section title="כפתורים">
        <div className={styles.row}>
          <Button>הוסיפו זיכרון</Button>
          <Button variant="secondary">עוד לא כתבתם?</Button>
          <Button variant="quiet">שיתוף הסיפור</Button>
          <Button disabled>שליחה</Button>
          <Button variant="secondary" size="small">
            הוסיפו זיכרון
          </Button>
        </div>
      </Section>

      <Section title="שבבים">
        <div className={styles.row}>
          <Chip selected={false}>מסע בזמן</Chip>
          <Chip selected>טיולים בארץ ובעולם</Chip>
          <Chip dashed>לא בטוחים – כללי</Chip>
        </div>
      </Section>

      <Section title="טפסים והתקדמות">
        <div className={styles.cards}>
          <TextField label="כותרת" optional placeholder="הטרמפ לאילת" />
          <TextField label="השם שלכם" error="צריך לכתוב שם" />
        </div>
        <div className={styles.cards}>
          <ProgressBar value={0.6} label="מעלה" />
          <ProgressBar value={1} state="done" label="הועלתה" />
          <ProgressBar value={0.3} state="error" label="נכשלה" />
        </div>
      </Section>

      <Section title="כרטיסים">
        <div className={styles.cards}>
          {['rose', 'sage'].map((tone) => (
            <Card key={tone} tone={tone}>
              <h3 className={styles.cardTitle}>הטרמפ לאילת</h3>
              <p className={styles.cardText}>
                זה היה בקיץ של 1975, ועמדנו בצומת כבר שלוש שעות כשפתאום...
              </p>
              <p className={styles.cardMeta}>הסיפור המלא ייחשף בקרוב</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="פולארויד">
        <div className={styles.polaroids}>
          <Polaroid caption="תמר" handwritten taped tilt="leftStrong" />
          <Polaroid caption="אילת · 1975" tilt="right" />
          <Polaroid caption="ההפגנה הראשונה" tilt="left" />
        </div>
      </Section>
    </main>
  )
}
