// A bootstrap response shaped like the live API's.
export const categories = [
  ['journey', 'מסע בזמן', 'rose'],
  ['protest', 'תקופת המחאה', 'sage'],
  ['travels', 'טיולים בארץ ובעולם', 'sage'],
  ['sayings', 'המשפטים של תמר', 'rose'],
  ['fun-fact', 'עובדה מעניינת על תמר', 'rose'],
  ['did-you-know', 'לא ידעתם על תמר', 'sage'],
  ['wishes', 'כמה מילים לתמר', 'rose'],
  ['general', 'לא בטוחים – כללי', 'sand'],
].map(([id, name, tone]) => ({
  id,
  name,
  tone,
  description: `תיאור ${name}`,
  prompt_hint: `שאלה על ${name}`,
}))

export const teaser = (overrides = {}) => ({
  view: 'teaser',
  id: 'st_aaaaaa01',
  kind: 'text',
  title: 'הטרמפ לאילת',
  excerpt: 'זה היה בקיץ של 1975.',
  author_name: 'ענת',
  author_relation: 'חברה מהצבא',
  category_id: 'travels',
  media_count: 3,
  created_at: '2026-12-01T10:00:00.000Z',
  ...overrides,
})

export const bootstrap = (overrides = {}) => ({
  site: {
    site_status: 'collecting',
    birthday_date: '2027-02-07',
    submissions_open: true,
    comments_open: false,
    reveal_message: '',
    stats: { stories: 2, contributors: 2, photos: 3 },
  },
  categories,
  stories: [
    teaser(),
    teaser({
      id: 'st_aaaaaa02',
      title: '',
      kind: 'text',
      author_name: 'דני',
      author_relation: '',
      category_id: 'sayings',
      media_count: 0,
      excerpt: 'נו, אז מה למדנו?',
    }),
  ],
  ...overrides,
})
