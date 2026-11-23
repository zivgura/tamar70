import { DEFAULT_CATEGORY_ID, SETTING_KEYS, SITE_STATUS } from '@tamar70/shared'

// First-run content for the Sheet. The *_en columns are the English site's texts. Category colors are tone names from the design system
// (rose, sage, terracotta, sand), matching the approved mockups.
// Written only into empty tabs (or missing settings), so
// edits made in the Sheet afterwards are never overwritten.

export const DEFAULT_CATEGORIES = [
  {
    id: 'journey',
    name: 'מסע בזמן',
    description: 'ילדות, נעורים, רגעים משמעותיים וסיפורים משפחתיים',
    prompt_hint: 'ספרו על חוויה משותפת מהעבר',
    name_en: 'A Journey Through Time',
    description_en: 'Childhood, youth, meaningful moments and family stories',
    prompt_hint_en: 'Tell us about something you shared in the past',
    color: 'rose',
  },
  {
    id: 'protest',
    name: 'מחאות פוליטיות',
    description: 'סיפורים, חוויות ואנשים מהמחאות שתמר השתתפה בהן',
    prompt_hint: 'באיזו מחאה הייתם יחד עם תמר?',
    name_en: 'Political Protests',
    description_en: 'Stories, experiences and people from the protests Tamar took part in',
    prompt_hint_en: 'Which protest were you at with Tamar?',
    color: 'sage',
  },
  {
    id: 'travels',
    name: 'טיולים בארץ ובעולם',
    description: 'הרפתקאות, טיולים ומקומות מיוחדים',
    prompt_hint: 'לאן טיילתם יחד, ומה קרה שם?',
    name_en: 'Trips in Israel and Abroad',
    description_en: 'Adventures, trips and special places',
    prompt_hint_en: 'Where did you travel together, and what happened there?',
    color: 'sage',
  },
  {
    id: 'culture',
    name: 'תרבות',
    description: 'ספרים, מוזיקה, הצגות, סרטים ואמנות בחייה של תמר',
    prompt_hint: 'על איזה ספר, הופעה או סרט תמר תמיד מדברת?',
    name_en: 'Culture',
    description_en: "Books, music, plays, films and art in Tamar's life",
    prompt_hint_en: 'Which book, show or film does Tamar always talk about?',
    color: 'rose',
  },
  {
    id: 'sayings',
    name: 'המשפטים של תמר',
    description: 'משפטים, ביטויים ואמירות שתמר נוהגת לומר',
    prompt_hint: 'מה תמר תמיד אומרת כש...?',
    name_en: "Tamar's Sayings",
    description_en: 'Phrases, expressions and things Tamar always says',
    prompt_hint_en: 'What does Tamar always say when...?',
    color: 'rose',
  },
  {
    id: 'did-you-know',
    name: 'דברים שלא ידעתם על תמר',
    description: 'עובדות מפתיעות, כישרונות חבויים, הרגלים ואנקדוטות משעשעות',
    prompt_hint: 'מה רק מעטים יודעים על תמר?',
    name_en: "Things You Didn't Know About Tamar",
    description_en: 'Surprising facts, hidden talents, habits and funny anecdotes',
    prompt_hint_en: 'What do only a few people know about Tamar?',
    color: 'sage',
  },
  {
    id: 'wishes',
    name: 'כמה מילים לתמר',
    description: 'ברכות, איחולים והבעת הערכה',
    prompt_hint: 'מה הייתם רוצים לאחל לתמר?',
    name_en: 'A Few Words for Tamar',
    description_en: 'Wishes, blessings and appreciation',
    prompt_hint_en: 'What would you like to wish Tamar?',
    color: 'rose',
  },
  {
    id: DEFAULT_CATEGORY_ID,
    name: 'לא בטוחים – כללי',
    description: 'כל מה שלא מתאים לפינה אחרת',
    prompt_hint: 'שתפו כל סיפור, משפט או תמונה',
    name_en: 'Not sure – general',
    description_en: "Anything that doesn't fit another corner",
    prompt_hint_en: 'Share any story, saying or photo',
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
  [SETTING_KEYS.NOTIFY_MODE]: 'each',
  [SETTING_KEYS.DIGEST_SENT_ON]: '',
  [SETTING_KEYS.HOUSEKEEPING_RAN_AT]: '',
  [SETTING_KEYS.BACKED_UP_AT]: '',
}

// No email addresses live in the code. The account that owns the script becomes the first
// admin; more admins are added as rows in the AdminUsers tab.
