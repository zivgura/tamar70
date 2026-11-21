import { describe, expect, it } from 'vitest'
import { storiesCsv, storiesHtml } from './exportFiles.js'

const data = {
  exported_at: '2026-12-01T10:00:00Z',
  stories: [
    {
      id: 'st_1',
      created_at: '2026-12-01T10:00:00Z',
      author_name: 'ענת',
      author_relation: 'חברה',
      corner: 'טיולים',
      title: 'הטרמפ <לאילת>',
      content: 'שורה, עם פסיק\nו"מרכאות"',
      decade: 1970,
      places: ['אילת', 'ערבה'],
      people: [],
      visibility: 'default',
      admin_notes: '',
      photos: [{ filename: 'a.jpg', caption: 'בצומת', year_approx: 1975, link: 'https://drive/a' }],
    },
  ],
}

describe('export files', () => {
  it('makes a readable page, escaping what people wrote', () => {
    const html = storiesHtml(data)
    expect(html).toContain('<html lang="he" dir="rtl">')
    expect(html).toContain('<h2>הטרמפ &lt;לאילת&gt;</h2>')
    expect(html).toContain('ענת, חברה · טיולים')
    expect(html).toContain('<a href="https://drive/a">בצומת</a> (1975)')
  })

  it('makes a CSV Excel reads in Hebrew, quoting commas, quotes and line breaks', () => {
    const csv = storiesCsv(data)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    const [head, row] = csv.slice(1).split('\r\n')
    expect(head.startsWith('נשלח,שם,קשר לתמר,פינה,כותרת,סיפור')).toBe(true)
    expect(row).toContain('"שורה, עם פסיק\nו""מרכאות"""')
    expect(row).toContain('"אילת, ערבה"')
  })
})
