import { DEFAULT_CATEGORY_ID, SETTING_KEYS, SITE_STATUS } from '@tamar70/shared'

// First-run content for the Sheet. Category colors are tone names from the design system
// (rose, sage, terracotta, sand), matching the approved mockups.
// Written only into empty tabs (or missing settings), so
// edits made in the Sheet afterwards are never overwritten.

export const DEFAULT_CATEGORIES = [
  {
    id: 'journey',
    name: 'מסע בזמן',
    description: 'ילדות, נעורים, רגעים משמעותיים וסיפורים משפחתיים',
    prompt_hint: 'ספרו על חוויה משותפת מהעבר',
    color: 'rose',
  },
  {
    id: 'protest',
    name: 'מחאות פוליטיות',
    description: 'סיפורים, חוויות ואנשים מהמחאות שתמר השתתפה בהן',
    prompt_hint: 'באיזו מחאה הייתם יחד עם תמר?',
    color: 'sage',
  },
  {
    id: 'travels',
    name: 'טיולים בארץ ובעולם',
    description: 'הרפתקאות, טיולים ומקומות מיוחדים',
    prompt_hint: 'לאן טיילתם יחד, ומה קרה שם?',
    color: 'sage',
  },
  {
    id: 'sayings',
    name: 'המשפטים של תמר',
    description: 'משפטים, ביטויים ואמירות שתמר נוהגת לומר',
    prompt_hint: 'מה תמר תמיד אומרת כש...?',
    color: 'rose',
  },
  {
    id: 'fun-fact',
    name: 'עובדה מעניינת על תמר',
    description: 'עובדות מפתיעות ומעניינות',
    prompt_hint: 'איזו עובדה על תמר תפתיע את כולם?',
    color: 'rose',
  },
  {
    id: 'did-you-know',
    name: 'לא ידעתם על תמר',
    description: 'כישרונות חבויים, הרגלים, אנקדוטות וסודות משעשעים',
    prompt_hint: 'מה רק מעטים יודעים על תמר?',
    color: 'sage',
  },
  {
    id: 'wishes',
    name: 'כמה מילים לתמר',
    description: 'ברכות, איחולים והבעת הערכה',
    prompt_hint: 'מה הייתם רוצים לאחל לתמר?',
    color: 'rose',
  },
  {
    id: DEFAULT_CATEGORY_ID,
    name: 'לא בטוחים – כללי',
    description: 'כל מה שלא מתאים לפינה אחרת',
    prompt_hint: 'שתפו כל סיפור, משפט או תמונה',
    color: 'sand',
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
  [SETTING_KEYS.NOTIFIED_UNTIL]: '',
  [SETTING_KEYS.CLEANED_AT]: '',
}

// No email addresses live in the code. The account that owns the script becomes the first
// admin; more admins are added as rows in the AdminUsers tab.
