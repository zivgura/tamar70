import { DEFAULT_CATEGORY_ID, SETTING_KEYS, SITE_STATUS } from '@tamar70/shared'

// First-run content for the Sheet. Written only into empty tabs (or missing settings), so
// edits made in the Sheet afterwards are never overwritten.

export const DEFAULT_CATEGORIES = [
  {
    id: 'journey',
    name: 'מסע בזמן',
    description: 'ילדות, נעורים, רגעים משמעותיים וזיכרונות משפחתיים',
    prompt_hint: 'ספרו על רגע מחייה של תמר שלא תשכחו',
    color: '#D4A5A0',
  },
  {
    id: 'protest',
    name: 'תקופת המחאה',
    description: 'סיפורים, חוויות ואנשים מתקופת המחאה',
    prompt_hint: 'איפה הייתם עם תמר בתקופת המחאה?',
    color: '#9CAF88',
  },
  {
    id: 'travels',
    name: 'טיולים בארץ ובעולם',
    description: 'הרפתקאות, טיולים ומקומות מיוחדים',
    prompt_hint: 'לאן טיילתם יחד, ומה קרה שם?',
    color: '#C0745A',
  },
  {
    id: 'sayings',
    name: 'המשפטים של תמר',
    description: 'משפטים, ביטויים ואמירות שתמר נוהגת לומר',
    prompt_hint: 'מה תמר תמיד אומרת כש...?',
    color: '#D4A5A0',
  },
  {
    id: 'fun-fact',
    name: 'עובדה מעניינת על תמר',
    description: 'עובדות מפתיעות ומעניינות',
    prompt_hint: 'איזו עובדה על תמר תפתיע את כולם?',
    color: '#9CAF88',
  },
  {
    id: 'did-you-know',
    name: 'לא ידעתם על תמר',
    description: 'כישרונות חבויים, הרגלים, אנקדוטות וסודות משעשעים',
    prompt_hint: 'מה רק מעטים יודעים על תמר?',
    color: '#C0745A',
  },
  {
    id: 'wishes',
    name: 'כמה מילים לתמר',
    description: 'ברכות, איחולים והבעת הערכה',
    prompt_hint: 'מה הייתם רוצים לאחל לתמר?',
    color: '#D4A5A0',
  },
  {
    id: DEFAULT_CATEGORY_ID,
    name: 'לא בטוחים – כללי',
    description: 'כל מה שלא מתאים לפינה אחרת',
    prompt_hint: 'שתפו כל זיכרון, סיפור או תמונה',
    color: '#9CAF88',
  },
].map((c, i) => ({ ...c, order: i + 1, active: true }))

export const DEFAULT_SETTINGS = {
  [SETTING_KEYS.SITE_STATUS]: SITE_STATUS.COLLECTING,
  [SETTING_KEYS.BIRTHDAY_DATE]: '2027-02-07',
  [SETTING_KEYS.SUBMISSIONS_OPEN]: 'TRUE',
  [SETTING_KEYS.COMMENTS_OPEN]: 'FALSE',
  [SETTING_KEYS.REVEAL_MESSAGE]: '',
  // Filled with the owner account's address on first run (see migrate.js).
  [SETTING_KEYS.NOTIFY_EMAILS]: '',
  [SETTING_KEYS.FAMILY_CODE_HASH]: '',
}

// No email addresses live in the code. The account that owns the script becomes the first
// admin; more admins are added as rows in the AdminUsers tab.
