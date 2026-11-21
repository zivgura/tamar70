// Turns the admin export into files people can open: a readable page (prints nicely, keeps
// working without the site), a spreadsheet, and the raw data.

const escapeHtml = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const day = (iso) =>
  iso
    ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'long', timeZone: 'Asia/Jerusalem' }).format(
        new Date(iso),
      )
    : ''

/** One self-contained HTML page with every story, in the order they arrived. */
export function storiesHtml({ stories, exported_at: exportedAt }) {
  const items = stories
    .map((s) => {
      const who = [s.author_name, s.author_relation].filter(Boolean).join(', ')
      const details = [
        s.corner,
        day(s.created_at),
        s.decade ? `שנות ה-${String(s.decade).slice(2)}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
      const photos = s.photos.length
        ? `<ul class="photos">${s.photos
            .map(
              (p) =>
                `<li><a href="${escapeHtml(p.link)}">${escapeHtml(p.caption || p.filename)}</a>${
                  p.year_approx ? ` (${p.year_approx})` : ''
                }</li>`,
            )
            .join('')}</ul>`
        : ''
      return `<article>
<h2>${escapeHtml(s.title || 'בלי כותרת')}</h2>
<p class="meta">${escapeHtml(who)} · ${escapeHtml(details)}</p>
${s.content ? `<p class="text">${escapeHtml(s.content)}</p>` : ''}
${photos}
</article>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>תמר בת 70 – כל הסיפורים</title>
<style>
body { max-width: 42rem; margin: 2rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; line-height: 1.6; }
article { padding: 1.5rem 0; border-top: 1px solid; break-inside: avoid; }
h2 { margin: 0 0 0.25rem; }
.meta { margin: 0 0 1rem; opacity: 0.7; font-size: 0.9rem; }
.text { white-space: pre-wrap; }
.photos { font-size: 0.9rem; }
</style>
</head>
<body>
<h1>תמר בת 70 – כל הסיפורים</h1>
<p class="meta">${stories.length} סיפורים · יוצא ב-${escapeHtml(day(exportedAt))}</p>
${items}
</body>
</html>
`
}

const BOM = String.fromCharCode(0xfeff)

const csvCell = (value) => {
  const s = Array.isArray(value) ? value.join(', ') : String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const COLUMNS = [
  ['created_at', 'נשלח'],
  ['author_name', 'שם'],
  ['author_relation', 'קשר לתמר'],
  ['corner', 'פינה'],
  ['title', 'כותרת'],
  ['content', 'סיפור'],
  ['decade', 'עשור'],
  ['places', 'מקומות'],
  ['people', 'אנשים'],
  ['visibility', 'מצב'],
  ['admin_notes', 'הערות'],
]

/** A spreadsheet of the stories. Starts with a BOM so Excel reads the Hebrew right. */
export function storiesCsv({ stories }) {
  const head = [...COLUMNS.map(([, label]) => label), 'תמונות']
  const rows = stories.map((s) => [
    ...COLUMNS.map(([key]) => s[key]),
    s.photos.map((p) => p.link).join('\n'),
  ])
  return `${BOM}${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`
}

/** Saves text as a file through the browser. */
export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
