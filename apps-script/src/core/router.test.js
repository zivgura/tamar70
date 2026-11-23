import { SCHEMA_VERSION, SETTING_KEYS, TABLES } from '@tamar70/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import { handleRequest } from './router.js'
import { writeSetting } from './settings.js'

let ctx

const call = (action, payload) => handleRequest(JSON.stringify({ action, payload }), ctx)
const ok = (action, payload) => {
  const res = call(action, payload)
  if (!res.ok) throw new Error(`${action} failed: ${JSON.stringify(res.error)}`)
  return res.data
}

let tokenCounter = 0
const newToken = () => `tok_${String(++tokenCounter).padStart(32, '0')}`

const submit = (overrides = {}) =>
  call('stories.submit', {
    edit_token: newToken(),
    kind: 'text',
    author_name: 'ענת',
    author_relation: 'חברה מהצבא',
    title: 'הטיול לסיני',
    content: 'זה היה בקיץ 1975. ואז הכול השתנה.',
    category_id: 'travels',
    ...overrides,
  })

beforeEach(() => {
  ctx = createMemoryContext()
  ok('site.get') // first request runs the migration
})

describe('request handling', () => {
  it('rejects a body that is not JSON', () => {
    expect(handleRequest('nope', ctx).error.code).toBe('bad_request')
  })

  it('rejects unknown actions, including prototype names', () => {
    expect(call('stories.drop').error.code).toBe('unknown_action')
    expect(call('toString').error.code).toBe('unknown_action')
  })

  it('hides internal errors behind a generic message', () => {
    ctx.db.all = () => {
      throw new Error('quota exceeded at line 42')
    }
    const res = call('stories.list')
    expect(res.error).toEqual({ code: 'internal', message: 'Something went wrong' })
  })
})

describe('migration', () => {
  it('creates every tab with its columns and seeds defaults', () => {
    for (const [name, cols] of Object.entries(TABLES)) {
      expect(ctx.db.tabs.get(name).headers).toEqual(cols.map((c) => c.name))
    }
    expect(ctx.schemaVersion.get()).toBe(SCHEMA_VERSION)
    expect(ok('categories.list').map((c) => c.id)).toContain('general')
    expect(ctx.db.all('AdminUsers').map((a) => a.email)).toEqual(['owner@example.test'])
    expect(ctx.db.all('Settings').find((s) => s.key === 'notify_emails').value).toBe(
      'owner@example.test',
    )
  })

  it('gives every corner a design-system tone', () => {
    const tones = Object.fromEntries(ok('categories.list').map((c) => [c.id, c.tone]))
    expect(tones).toMatchObject({ journey: 'rose', protest: 'sage', general: 'sand' })
    expect(ok('categories.list')[0]).not.toHaveProperty('color')
  })

  it('upgrades a version 1 Sheet: hex category colors become tone names', () => {
    const v1 = createMemoryContext()
    v1.db.ensureTable(
      'Categories',
      TABLES.Categories.map((c) => c.name),
    )
    v1.db.insert('Categories', { id: 'travels', name: 'טיולים', color: '#C0745A', active: true })
    v1.db.insert('Categories', { id: 'custom', name: 'משלי', color: '#9CAF88', active: true })
    v1.db.insert('Categories', { id: 'odd', name: 'אחר', color: 'purple', active: true })
    v1.db.insert('Categories', { id: 'kept', name: 'נשמר', color: 'terracotta', active: true })
    v1.schemaVersion.set(1)
    ctx = v1
    ok('site.get')

    const colors = Object.fromEntries(ctx.db.all('Categories').map((c) => [c.id, c.color]))
    // A known corner gets its mockup tone; others map by hex; unknown values become neutral.
    expect(colors).toMatchObject({
      travels: 'sage',
      custom: 'sage',
      odd: 'sand',
      kept: 'terracotta',
    })
    expect(ctx.schemaVersion.get()).toBe(SCHEMA_VERSION)
  })

  it('upgrades a version 2 Sheet to say "סיפור", leaving edited texts alone', () => {
    const v2 = createMemoryContext()
    v2.db.ensureTable(
      'Categories',
      TABLES.Categories.map((c) => c.name),
    )
    v2.db.insert('Categories', {
      id: 'journey',
      color: 'rose',
      description: 'ילדות, נעורים, רגעים משמעותיים וזיכרונות משפחתיים',
      active: true,
    })
    v2.db.insert('Categories', {
      id: 'general',
      color: 'sand',
      prompt_hint: 'זיכרון שכתבתי בעצמי',
      active: true,
    })
    v2.db.insert('Categories', {
      id: 'protest',
      name: 'תקופת המחאה',
      color: 'sage',
      description: 'סיפורים, חוויות ואנשים מתקופת המחאה',
      prompt_hint: 'איפה הייתם עם תמר בתקופת המחאה?',
      active: true,
    })
    v2.schemaVersion.set(2)
    ctx = v2
    ok('site.get')

    const byId = Object.fromEntries(ctx.db.all('Categories').map((c) => [c.id, c]))
    expect(byId.journey.description).toBe('ילדות, נעורים, רגעים משמעותיים וסיפורים משפחתיים')
    expect(byId.general.prompt_hint).toBe('זיכרון שכתבתי בעצמי')
    expect(byId.protest).toMatchObject({
      name: 'מחאות פוליטיות',
      description: 'סיפורים, חוויות ואנשים מהמחאות שתמר השתתפה בהן',
      prompt_hint: 'באיזו מחאה הייתם יחד עם תמר?',
    })
  })

  it('upgrades a version 8 Sheet: adds "תרבות" and merges the fun-fact corner', () => {
    const v8 = createMemoryContext()
    for (const name of ['Categories', 'Stories']) {
      v8.db.ensureTable(
        name,
        TABLES[name].map((c) => c.name),
      )
    }
    const old = [
      ['journey', 'מסע בזמן', 1],
      ['protest', 'מחאות פוליטיות', 2],
      ['travels', 'טיולים בארץ ובעולם', 3],
      ['sayings', 'המשפטים של תמר', 4],
      ['fun-fact', 'עובדה מעניינת על תמר', 5],
      ['did-you-know', 'לא ידעתם על תמר', 6],
      ['wishes', 'כמה מילים לתמר', 7],
      ['general', 'לא בטוחים – כללי', 8],
    ]
    for (const [id, name, order] of old) {
      v8.db.insert('Categories', {
        id,
        name,
        order,
        color: 'rose',
        active: true,
        description:
          id === 'did-you-know' ? 'כישרונות חבויים, הרגלים, אנקדוטות וסודות משעשעים' : '',
      })
    }
    v8.db.insert('Stories', { id: 'st_fact000001', category_id: 'fun-fact', status: 'active' })
    v8.db.insert('Stories', { id: 'st_trip000001', category_id: 'travels', status: 'active' })
    v8.schemaVersion.set(8)
    ctx = v8
    ok('site.get')

    expect(ok('categories.list').map((c) => [c.id, c.name])).toEqual([
      ['journey', 'מסע בזמן'],
      ['protest', 'מחאות פוליטיות'],
      ['travels', 'טיולים בארץ ובעולם'],
      ['culture', 'תרבות'],
      ['sayings', 'המשפטים של תמר'],
      ['did-you-know', 'דברים שלא ידעתם על תמר'],
      ['wishes', 'כמה מילים לתמר'],
      ['general', 'לא בטוחים – כללי'],
    ])
    // Version 10 adds the English texts.
    const english = Object.fromEntries(ok('categories.list').map((c) => [c.id, c.name_en]))
    expect(english).toMatchObject({ culture: 'Culture', travels: 'Trips in Israel and Abroad' })
    const stories = Object.fromEntries(ctx.db.all('Stories').map((s) => [s.id, s.category_id]))
    expect(stories).toEqual({ st_fact000001: 'did-you-know', st_trip000001: 'travels' })
    // The old row stays in the Sheet, hidden.
    expect(ctx.db.all('Categories').find((c) => c.id === 'fun-fact').active).toBe(false)
    expect(ctx.db.all('Categories').filter((c) => c.id === 'culture')).toHaveLength(1)
  })

  it('files a story sent to the old fun-fact corner under the merged one', () => {
    const { id } = ok('stories.submit', {
      kind: 'text',
      author_name: 'דנה',
      content: 'תמר יודעת לשרוק עם שתי אצבעות',
      category_id: 'fun-fact',
      edit_token: 'e'.repeat(32),
    })
    expect(ctx.db.all('Stories').find((s) => s.id === id).category_id).toBe('did-you-know')
  })

  it('seeds a new Sheet without memorial wording', () => {
    const text = JSON.stringify(ok('categories.list'))
    expect(text).not.toMatch(/זיכרו|תשכחו|תקופת המחאה/)
    expect(text).toContain('מחאות פוליטיות')
  })

  it('maps an unknown tone in the Sheet to the neutral tone in the API', () => {
    ctx.db.update('Categories', 'id', 'journey', { color: '#123456' })
    expect(ok('categories.list').find((c) => c.id === 'journey').tone).toBe('sand')
  })

  it('does not overwrite settings edited in the Sheet', () => {
    writeSetting(ctx.db, SETTING_KEYS.BIRTHDAY_DATE, '2027-02-08')
    ctx.schemaVersion.set(0)
    ok('site.get')
    expect(ok('site.get').birthday_date).toBe('2027-02-08')
    expect(ctx.db.all('Settings').filter((s) => s.key === 'birthday_date')).toHaveLength(1)
  })

  it('adds a column that is missing without touching existing data', () => {
    const fresh = createMemoryContext()
    const withoutTags = TABLES.Stories.map((c) => c.name).filter((n) => n !== 'tags')
    fresh.db.ensureTable('Stories', withoutTags)
    fresh.db.insert('Stories', { id: 'st_existing1', title: 'old' })
    ctx = fresh
    ok('site.get')
    const stories = ctx.db.tabs.get('Stories')
    expect(stories.headers.at(-1)).toBe('tags')
    expect(ctx.db.all('Stories')[0]).toMatchObject({ id: 'st_existing1', title: 'old', tags: [] })
  })
})

describe('stories.submit', () => {
  it('saves a story and returns its id', () => {
    const res = submit()
    expect(res.ok).toBe(true)
    expect(res.data.id).toMatch(/^st_/)
    const [row] = ctx.db.all('Stories')
    expect(row).toMatchObject({
      author_name: 'ענת',
      category_id: 'travels',
      excerpt: 'זה היה בקיץ 1975.',
      status: 'active',
      visibility: 'default',
    })
    expect(row.edit_token_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('needs no code, and ignores one sent by an older page', () => {
    expect(submit({ family_code: 'anything' }).ok).toBe(true)
  })

  it('caps how many stories can come in an hour', () => {
    for (let i = 0; i < 60; i++)
      expect(submit({ edit_token: `t${String(i).padStart(39, '0')}` }).ok).toBe(true)
    expect(submit({ edit_token: 'z'.repeat(40) }).error.code).toBe('busy')
  })

  it('refuses when submissions are closed', () => {
    writeSetting(ctx.db, SETTING_KEYS.SUBMISSIONS_OPEN, 'FALSE')
    expect(submit().error.code).toBe('submissions_closed')
  })

  it('reports validation problems with field paths', () => {
    const res = submit({ author_name: '' })
    expect(res.error.code).toBe('validation')
    expect(res.error.details.map((d) => d.path)).toContain('author_name')
  })

  it('does not save the same submission twice', () => {
    const edit_token = newToken()
    const first = submit({ edit_token })
    const retry = submit({ edit_token })
    expect(retry.data).toEqual({ id: first.data.id, duplicate: true })
    expect(ctx.db.all('Stories')).toHaveLength(1)
  })

  it('pretends to accept honeypot submissions but saves nothing', () => {
    const res = submit({ website: 'http://spam.example' })
    expect(res.ok).toBe(true)
    expect(ctx.db.all('Stories')).toHaveLength(0)
  })

  it('falls back to the general corner for an unknown category', () => {
    submit({ category_id: 'no-such-corner' })
    expect(ctx.db.all('Stories')[0].category_id).toBe('general')
  })

  it('stores formula-looking text safely and returns it unchanged', () => {
    submit({ title: '=IMPORTXML("http://evil")' })
    expect(ok('stories.list').stories[0].title).toBe('=IMPORTXML("http://evil")')
  })
})

describe('reading stories', () => {
  it('sends teasers only while collecting', () => {
    submit()
    const { site_status, stories } = ok('stories.list')
    expect(site_status).toBe('collecting')
    expect(stories[0]).toMatchObject({ view: 'teaser', title: 'הטיול לסיני' })
    expect(stories[0]).not.toHaveProperty('content')
    expect(stories[0]).not.toHaveProperty('edit_token_hash')
  })

  it('sends full stories once published', () => {
    const { id } = submit().data
    writeSetting(ctx.db, SETTING_KEYS.SITE_STATUS, 'published')
    ctx.cache.store.clear()
    expect(ok('stories.get', { id })).toMatchObject({ view: 'full', content: expect.any(String) })
  })

  it('hides hidden and deleted stories everywhere', () => {
    const a = submit().data.id
    const b = submit().data.id
    ctx.db.update('Stories', 'id', a, { visibility: 'hidden' })
    ctx.db.update('Stories', 'id', b, { status: 'deleted' })
    ctx.cache.store.clear()
    expect(ok('stories.list').stories).toHaveLength(0)
    expect(call('stories.get', { id: a }).error.code).toBe('not_found')
    expect(ok('site.get').stats.stories).toBe(0)
  })

  it('lists newest first', () => {
    submit({ title: 'ראשון' })
    ctx.setNow('2026-12-02T10:00:00.000Z')
    submit({ title: 'שני' })
    expect(ok('stories.list').stories.map((s) => s.title)).toEqual(['שני', 'ראשון'])
  })

  it('serves the list from cache and refreshes it after a submission', () => {
    submit()
    ok('stories.list')
    expect(ctx.cache.store.has('stories.list')).toBe(true)
    submit()
    expect(ctx.cache.store.has('stories.list')).toBe(false)
    expect(ok('stories.list').stories).toHaveLength(2)
  })

  it('rejects a malformed story id', () => {
    expect(call('stories.get', { id: '../etc' }).error.code).toBe('validation')
  })
})

describe('site.bootstrap', () => {
  it('returns site, corners and teasers in one call', () => {
    submit({ author_name: 'ענת' })
    submit({ author_name: 'דני', category_id: 'sayings' })
    const data = ok('site.bootstrap')
    expect(data.site).toMatchObject({
      site_status: 'collecting',
      stats: { stories: 2, contributors: 2 },
    })
    expect(data.categories).toHaveLength(8)
    expect(data.stories.map((s) => s.view)).toEqual(['teaser', 'teaser'])
    expect(JSON.stringify(data)).not.toContain('content')
  })

  it('is cached, and a new story clears the cache', () => {
    ok('site.bootstrap')
    expect(ctx.cache.store.has('site.bootstrap')).toBe(true)
    submit()
    expect(ctx.cache.store.has('site.bootstrap')).toBe(false)
    expect(ok('site.bootstrap').stories).toHaveLength(1)
  })

  it('returns empty text, not null, for fields left blank', () => {
    submit({ author_relation: '', title: '' })
    const [story] = ok('site.bootstrap').stories
    expect(story.author_relation).toBe('')
    expect(story.title).toBe('')
  })
})

describe('site.get', () => {
  it('counts stories and distinct contributors', () => {
    submit({ author_name: 'ענת' })
    submit({ author_name: ' ענת ' })
    submit({ author_name: 'דני' })
    expect(ok('site.get')).toMatchObject({
      site_status: 'collecting',
      birthday_date: '2027-02-07',
      submissions_open: true,
      stats: { stories: 3, contributors: 2, photos: 0 },
    })
  })

  it('never exposes the family code hash', () => {
    expect(JSON.stringify(ok('site.get'))).not.toContain('family_code')
  })
})
