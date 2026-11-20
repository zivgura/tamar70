import { GOOGLE_CLIENT_ID } from '@tamar70/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import { rotateFamilyCode } from './familyCode.js'
import { handleRequest } from './router.js'

let ctx
let code
const ADMIN = 'A'.repeat(200)
const OUTSIDER = 'B'.repeat(200)
const EXPIRED = 'C'.repeat(200)
const OTHER_APP = 'D'.repeat(200)
const editToken = 'e'.repeat(40)

const call = (action, payload) => handleRequest(JSON.stringify({ action, payload }), ctx)
const ok = (action, payload) => {
  const res = call(action, payload)
  if (!res.ok) throw new Error(`${action} failed: ${JSON.stringify(res.error)}`)
  return res.data
}

// 2026-12-01T10:00:00Z, the memory context's clock.
const NOW = Date.parse('2026-12-01T10:00:00.000Z') / 1000
const claims = (email, overrides = {}) => ({
  aud: GOOGLE_CLIENT_ID,
  iss: 'https://accounts.google.com',
  email,
  email_verified: 'true',
  exp: String(NOW + 3000),
  ...overrides,
})

function submit(overrides = {}) {
  return ok('stories.submit', {
    kind: 'text',
    author_name: 'ענת',
    title: 'הטרמפ',
    content: 'זה היה בקיץ. ואז עוד.',
    category_id: 'travels',
    edit_token: overrides.edit_token ?? editToken,
    family_code: code,
    ...overrides,
  }).id
}

function addPhoto(story) {
  const { media_id, upload_url } = ok('media.start', {
    story_id: story,
    edit_token: editToken,
    origin: 'https://tamar70.web.app',
    filename: 'p.jpg',
    mime: 'image/jpeg',
    bytes: 1000,
  })
  const drive_file_id = ctx.drive.browserUpload(upload_url)
  ok('media.finish', { story_id: story, edit_token: editToken, media_id, drive_file_id })
  return { media_id, drive_file_id }
}

beforeEach(() => {
  ctx = createMemoryContext()
  ok('site.get')
  code = rotateFamilyCode(ctx).code
  ctx.google.tokens.set(ADMIN, claims('Owner@Example.test'))
  ctx.google.tokens.set(OUTSIDER, claims('someone@example.test'))
  ctx.google.tokens.set(EXPIRED, claims('owner@example.test', { exp: String(NOW - 5) }))
  ctx.google.tokens.set(OTHER_APP, claims('owner@example.test', { aud: 'another-app' }))
})

describe('admin sign-in', () => {
  it('knows the owner, whatever the letter case', () => {
    expect(ok('admin.me', { id_token: ADMIN })).toEqual({
      email: 'owner@example.test',
      name: 'Owner',
    })
  })

  it('asks to sign in again for missing, unknown, expired or foreign tokens', () => {
    expect(call('admin.stories', {}).error.code).toBe('validation')
    for (const token of ['Z'.repeat(200), EXPIRED, OTHER_APP]) {
      expect(call('admin.stories', { id_token: token }).error.code).toBe('sign_in_required')
    }
  })

  it('refuses a Google account that is not in AdminUsers', () => {
    expect(call('admin.stories', { id_token: OUTSIDER }).error.code).toBe('not_admin')
  })

  it('checks a token with Google once, then remembers it', () => {
    ok('admin.me', { id_token: ADMIN })
    ok('admin.stories', { id_token: ADMIN })
    expect(ctx.google.calls).toBe(1)
  })

  it('stops a removed admin at once, even with a remembered token', () => {
    ctx.db.insert('AdminUsers', { email: 'someone@example.test', name: 'Ziv', added_at: '' })
    expect(ok('admin.me', { id_token: OUTSIDER }).name).toBe('Ziv')
    const tab = ctx.db.tabs.get('AdminUsers')
    tab.rows = tab.rows.filter((r) => !String(r[0]).includes('someone'))
    expect(call('admin.me', { id_token: OUTSIDER }).error.code).toBe('not_admin')
  })
})

describe('admin stories', () => {
  it('lists every story with full text, never the edit token hash', () => {
    const id = submit()
    const { stories, categories, site_status } = ok('admin.stories', { id_token: ADMIN })
    expect(site_status).toBe('collecting')
    expect(categories.length).toBeGreaterThan(5)
    expect(stories).toHaveLength(1)
    expect(stories[0]).toMatchObject({ id, content: 'זה היה בקיץ. ואז עוד.', status: 'active' })
    expect(stories[0]).not.toHaveProperty('edit_token_hash')
  })

  it('shows a story with its photos as thumbnails', () => {
    const id = submit()
    const { drive_file_id } = addPhoto(id)
    const { story, photos } = ok('admin.story', { id_token: ADMIN, id })
    expect(story.id).toBe(id)
    expect(photos).toHaveLength(1)
    expect(photos[0]).toMatchObject({
      upload_status: 'done',
      thumbnail: `data:image/png;base64,${drive_file_id}`,
    })
  })

  it('hides a story from the public and shows it again', () => {
    const id = submit()
    ok('admin.setVisibility', { id_token: ADMIN, id, visibility: 'hidden' })
    expect(ok('site.bootstrap').stories).toHaveLength(0)
    ok('admin.setVisibility', { id_token: ADMIN, id, visibility: 'default' })
    expect(ok('site.bootstrap').stories).toHaveLength(1)
  })

  it('edits the text and teaser, and logs who did it', () => {
    const id = submit()
    const base = {
      id_token: ADMIN,
      id,
      title: 'כותרת חדשה',
      content: 'טקסט מתוקן. עם עוד משפט.',
      author_name: 'ענת כ.',
      author_relation: 'חברה',
      category_id: 'journey',
      admin_notes: 'תוקן כתיב',
    }
    ok('admin.storyUpdate', { ...base, excerpt: 'טיזר שלא מגלה הכל' })
    const teaser = ok('site.bootstrap').stories[0]
    expect(teaser).toMatchObject({
      title: 'כותרת חדשה',
      excerpt: 'טיזר שלא מגלה הכל',
      category_id: 'journey',
    })
    expect(teaser).not.toHaveProperty('admin_notes')

    // An empty teaser goes back to the first sentence.
    ok('admin.storyUpdate', { ...base, excerpt: '' })
    expect(ok('site.bootstrap').stories[0].excerpt).toBe('טקסט מתוקן.')
    expect(ctx.db.all('AuditLog')).toEqual([
      expect.objectContaining({
        admin_email: 'owner@example.test',
        action: 'story.update',
        target_id: id,
      }),
      expect.objectContaining({ action: 'story.update' }),
    ])
  })

  it('deletes a story and trashes its photos', () => {
    const id = submit()
    const { drive_file_id } = addPhoto(id)
    ok('admin.storyDelete', { id_token: ADMIN, id })
    expect(ok('site.bootstrap').stories).toHaveLength(0)
    expect(ctx.drive.trashed.has(drive_file_id)).toBe(true)
    // Still listed for admins, marked deleted; no further changes.
    expect(ok('admin.stories', { id_token: ADMIN }).stories[0].status).toBe('deleted')
    expect(
      call('admin.setVisibility', { id_token: ADMIN, id, visibility: 'hidden' }).error.code,
    ).toBe('not_found')
  })

  it('removes one photo and recounts', () => {
    const id = submit()
    const first = addPhoto(id)
    addPhoto(id)
    const res = ok('admin.mediaRemove', { id_token: ADMIN, media_id: first.media_id })
    expect(res.media_count).toBe(1)
    expect(ctx.drive.trashed.has(first.drive_file_id)).toBe(true)
    expect(ok('admin.story', { id_token: ADMIN, id }).photos).toHaveLength(1)
  })

  it('refuses every write without an admin', () => {
    const id = submit()
    expect(call('admin.storyDelete', { id_token: OUTSIDER, id }).error.code).toBe('not_admin')
    expect(ok('site.bootstrap').stories).toHaveLength(1)
  })
})
