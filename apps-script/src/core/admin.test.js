import { GOOGLE_CLIENT_ID } from '@tamar70/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import { housekeeping } from './housekeeping.js'
import { handleRequest } from './router.js'
import { writeSetting } from './settings.js'

let ctx
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

describe('admin settings', () => {
  it('shows and changes how often emails go out, and sends a test email', () => {
    expect(ok('admin.settings', { id_token: ADMIN })).toEqual({
      site_status: 'collecting',
      comments_open: false,
      sharing: { shared: 0, total: 0, to_close: 0 },
      notify_mode: 'each',
      recipients: ['owner@example.test'],
      housekeeping_ran_at: null,
      backup: { backed_up_at: null, folder_url: 'https://drive.google.com/drive/folders/backups' },
    })
    expect(ok('admin.settingsUpdate', { id_token: ADMIN, notify_mode: 'daily' }).notify_mode).toBe(
      'daily',
    )
    expect(
      call('admin.settingsUpdate', { id_token: ADMIN, notify_mode: 'hourly' }).error.code,
    ).toBe('validation')
    expect(ok('admin.testEmail', { id_token: ADMIN }).sent).toBe(true)
    expect(ctx.mail.sent).toHaveLength(1)
    expect(call('admin.testEmail', { id_token: OUTSIDER }).error.code).toBe('not_admin')
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

describe('the reveal', () => {
  const photoUrl = (fid, w) => `https://lh3.googleusercontent.com/d/${fid}=w${w}`

  it('opens every story and shares its photos, and can be undone', () => {
    const id = submit()
    const { drive_file_id } = addPhoto(id)
    expect(ok('site.bootstrap').stories[0].view).toBe('teaser')
    expect(ok('gallery.list').photos).toEqual([])

    const after = ok('admin.setSiteStatus', { id_token: ADMIN, site_status: 'published' })
    expect(after.site_status).toBe('published')
    expect(after.sharing).toEqual({ shared: 1, total: 1, to_close: 0 })
    expect(ctx.drive.shared.has(drive_file_id)).toBe(true)

    // Lists get a card with a cover and no text; the story page gets the text and photos.
    const [card] = ok('site.bootstrap').stories
    expect(card).toMatchObject({ view: 'full', cover: photoUrl(drive_file_id, 600) })
    expect(card).not.toHaveProperty('content')
    const story = ok('stories.get', { id })
    expect(story.content).toBe('זה היה בקיץ. ואז עוד.')
    expect(story.photos).toEqual([
      expect.objectContaining({
        url: photoUrl(drive_file_id, 1600),
        thumb: photoUrl(drive_file_id, 600),
      }),
    ])
    expect(ok('gallery.list').photos).toEqual([
      expect.objectContaining({ story_id: id, story_title: 'הטרמפ', author_name: 'ענת' }),
    ])

    ok('admin.setSiteStatus', { id_token: ADMIN, site_status: 'collecting' })
    expect(ctx.drive.shared.has(drive_file_id)).toBe(false)
    expect(ok('site.bootstrap').stories[0].view).toBe('teaser')
    expect(call('stories.get', { id }).data).not.toHaveProperty('content')
  })

  it('shares in batches, finished by the timer', async () => {
    const id = submit()
    for (let i = 0; i < 3; i++) addPhoto(id)
    const { syncSharing } = await import('./reveal.js')
    writeSetting(ctx.db, 'site_status', 'published')
    expect(syncSharing(ctx, { limit: 2 })).toBe(2)
    expect(ok('admin.settings', { id_token: ADMIN }).sharing).toEqual({
      shared: 2,
      total: 3,
      to_close: 0,
    })
    housekeeping(ctx)
    expect(ok('admin.settings', { id_token: ADMIN }).sharing).toMatchObject({ shared: 3 })
  })

  it("opens one story early, and closes a hidden story's photos", () => {
    const id = submit()
    const { drive_file_id } = addPhoto(id)
    ok('admin.setVisibility', { id_token: ADMIN, id, visibility: 'early' })
    expect(ctx.drive.shared.has(drive_file_id)).toBe(true)
    expect(ok('stories.get', { id }).photos).toHaveLength(1)
    ok('admin.setVisibility', { id_token: ADMIN, id, visibility: 'hidden' })
    expect(ctx.drive.shared.has(drive_file_id)).toBe(false)
  })

  it('is for admins only', () => {
    expect(
      call('admin.setSiteStatus', { id_token: OUTSIDER, site_status: 'published' }).error.code,
    ).toBe('not_admin')
  })
})

describe('backup and export', () => {
  it('copies the Sheet on demand and weekly, keeping the newest ten', async () => {
    const { weeklyBackup } = await import('./backup.js')
    const res = ok('admin.backup', { id_token: ADMIN })
    expect(res).toEqual({ backed_up_at: '2026-12-01T10:00:00.000Z', url: 'https://sheet/0' })
    expect(ctx.backups.copies[0].name).toBe('גיבוי תמר בת 70 2026-12-01')
    expect(ok('admin.settings', { id_token: ADMIN }).backup).toEqual({
      backed_up_at: '2026-12-01T10:00:00.000Z',
      folder_url: 'https://drive.google.com/drive/folders/backups',
    })

    ctx.setNow('2026-12-05T10:00:00.000Z')
    expect(weeklyBackup(ctx)).toBeNull() // not a week yet
    for (let week = 1; week <= 11; week++) {
      ctx.setNow(new Date(Date.parse('2026-12-01T10:00:00Z') + week * 7.1 * 864e5).toISOString())
      weeklyBackup(ctx)
    }
    expect(ctx.backups.list()).toHaveLength(10)
    expect(ctx.backups.copies[0].trashed).toBe(true)
  })

  it('exports every story that was not deleted, with photo links', () => {
    const id = submit()
    const { drive_file_id } = addPhoto(id)
    const gone = submit({ edit_token: 'g'.repeat(40) })
    ok('admin.storyDelete', { id_token: ADMIN, id: gone })
    const { stories, exported_at } = ok('admin.export', { id_token: ADMIN })
    expect(exported_at).toBe('2026-12-01T10:00:00.000Z')
    expect(stories).toHaveLength(1)
    expect(stories[0]).toMatchObject({
      id,
      corner: 'טיולים בארץ ובעולם',
      content: 'זה היה בקיץ. ואז עוד.',
      photos: [
        { filename: 'p.jpg', link: `https://drive.google.com/file/d/${drive_file_id}/view` },
      ],
    })
    expect(call('admin.export', { id_token: OUTSIDER }).error.code).toBe('not_admin')
  })
})

describe('comments', () => {
  const comment = (id, overrides = {}) =>
    call('comments.add', { story_id: id, author_name: 'רון', content: 'איזה סיפור!', ...overrides })

  it('open with the reveal, show under the story, and close with the undo', () => {
    const id = submit()
    expect(comment(id).error.code).toBe('comments_closed')

    expect(
      ok('admin.setSiteStatus', { id_token: ADMIN, site_status: 'published' }).comments_open,
    ).toBe(true)
    const added = comment(id).data
    expect(added).toMatchObject({ author_name: 'רון', content: 'איזה סיפור!' })
    expect(added.id).toMatch(/^cm_/)
    expect(ok('stories.get', { id }).comments).toEqual([added])
    expect(ok('site.bootstrap').stories[0].comment_count).toBe(1)
    expect(ok('site.bootstrap').site.comments_open).toBe(true)

    ok('admin.setSiteStatus', { id_token: ADMIN, site_status: 'collecting' })
    expect(comment(id).error.code).toBe('comments_closed')
  })

  it('can be switched off by an admin after the reveal', () => {
    const id = submit()
    ok('admin.setSiteStatus', { id_token: ADMIN, site_status: 'published' })
    expect(
      ok('admin.settingsUpdate', { id_token: ADMIN, comments_open: false }).comments_open,
    ).toBe(false)
    expect(comment(id).error.code).toBe('comments_closed')
  })

  it('needs a name and some text, and ignores bots', () => {
    const id = submit()
    ok('admin.setSiteStatus', { id_token: ADMIN, site_status: 'published' })
    expect(comment(id, { author_name: ' ' }).error.code).toBe('validation')
    expect(comment(id, { content: '' }).error.code).toBe('validation')
    expect(comment(id, { website: 'spam.example' }).ok).toBe(true)
    expect(ctx.db.all('Comments')).toHaveLength(0)
  })

  it('are listed for admins and deleted by them', () => {
    const id = submit()
    ok('admin.setSiteStatus', { id_token: ADMIN, site_status: 'published' })
    const { id: commentId } = comment(id).data
    expect(ok('admin.story', { id_token: ADMIN, id }).comments).toHaveLength(1)
    ok('admin.commentDelete', { id_token: ADMIN, comment_id: commentId })
    expect(ok('stories.get', { id }).comments).toEqual([])
    expect(
      call('admin.commentDelete', { id_token: OUTSIDER, comment_id: commentId }).error.code,
    ).toBe('not_admin')
  })
})
