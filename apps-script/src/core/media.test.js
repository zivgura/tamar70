import { MAX_PHOTOS_PER_STORY, SETTING_KEYS } from '@tamar70/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import { handleRequest } from './router.js'
import { writeSetting } from './settings.js'

let ctx
let story
const token = 't'.repeat(40)

const call = (action, payload) => handleRequest(JSON.stringify({ action, payload }), ctx)
const ok = (action, payload) => {
  const res = call(action, payload)
  if (!res.ok) throw new Error(`${action} failed: ${JSON.stringify(res.error)}`)
  return res.data
}

const startPayload = (overrides = {}) => ({
  story_id: story,
  edit_token: token,
  origin: 'https://tamar70.web.app',
  filename: 'IMG_0001.JPG',
  mime: 'image/jpeg',
  bytes: 3_000_000,
  ...overrides,
})

/** The whole flow: start, the browser uploads to Drive, finish. */
function uploadPhoto(overrides = {}) {
  const { media_id, upload_url } = ok('media.start', startPayload(overrides))
  const drive_file_id = ctx.drive.browserUpload(upload_url)
  return { media_id, drive_file_id, upload_url }
}

beforeEach(() => {
  ctx = createMemoryContext()
  ok('site.get')
  story = ok('stories.submit', {
    edit_token: token,
    kind: 'photos',
    author_name: 'רונית',
  }).id
})

describe('media.start', () => {
  it('opens a Drive session for this file in the originals folder', () => {
    const { media_id, upload_url } = ok('media.start', startPayload({ caption: 'בים' }))
    expect(media_id).toMatch(/^md_/)
    expect(ctx.drive.sessions.get(upload_url)).toEqual({
      name: `${media_id}-IMG_0001.JPG`,
      mime: 'image/jpeg',
      bytes: 3_000_000,
      origin: 'https://tamar70.web.app',
      properties: { media_id, story_id: story },
    })
    expect(ctx.db.all('Media')[0]).toMatchObject({
      id: media_id,
      story_id: story,
      upload_status: 'pending',
      caption: 'בים',
      is_shared: false,
    })
  })

  it('needs the edit token of this story', () => {
    expect(call('media.start', startPayload({ edit_token: 'x'.repeat(40) })).error.code).toBe(
      'forbidden',
    )
    expect(call('media.start', startPayload({ story_id: 'st_nosuchstory' })).error.code).toBe(
      'forbidden',
    )
    expect(ctx.drive.sessions.size).toBe(0)
  })

  it('only opens sessions for the site itself', () => {
    const res = call('media.start', startPayload({ origin: 'https://evil.example' }))
    expect(res.error.code).toBe('validation')
  })

  it('refuses when submissions are closed', () => {
    writeSetting(ctx.db, SETTING_KEYS.SUBMISSIONS_OPEN, 'FALSE')
    expect(call('media.start', startPayload()).error.code).toBe('submissions_closed')
  })

  it(`caps a memory at ${MAX_PHOTOS_PER_STORY} photos`, () => {
    for (let i = 0; i < MAX_PHOTOS_PER_STORY; i++) ok('media.start', startPayload())
    expect(call('media.start', startPayload()).error.code).toBe('too_many_photos')
  })

  it('reports a Drive failure without saving a row', () => {
    ctx.drive.failNextSession = true
    expect(call('media.start', startPayload()).error.code).toBe('upload_failed')
    expect(ctx.db.all('Media')).toHaveLength(0)
  })
})

describe('media.finish', () => {
  it('marks the photo done and counts it on the story', () => {
    const { media_id, drive_file_id } = uploadPhoto()
    expect(
      ok('media.finish', { story_id: story, edit_token: token, media_id, drive_file_id }),
    ).toEqual({ media_id, width: 4032, height: 3024 })
    expect(ctx.db.all('Media')[0]).toMatchObject({ upload_status: 'done', drive_file_id })
    expect(ok('stories.list').stories[0].media_count).toBe(1)
    expect(ok('site.get').stats.photos).toBe(1)
  })

  it('is safe to repeat', () => {
    const { media_id, drive_file_id } = uploadPhoto()
    const args = { story_id: story, edit_token: token, media_id, drive_file_id }
    ok('media.finish', args)
    expect(ok('media.finish', args).duplicate).toBe(true)
    expect(ctx.db.all('Stories')[0].media_count).toBe(1)
  })

  it('rejects a Drive file that belongs to a different photo', () => {
    const a = uploadPhoto()
    const b = uploadPhoto()
    const res = call('media.finish', {
      story_id: story,
      edit_token: token,
      media_id: a.media_id,
      drive_file_id: b.drive_file_id,
    })
    expect(res.error.code).toBe('upload_failed')
  })

  it('rejects a file outside the originals folder or that does not exist', () => {
    const { media_id, drive_file_id } = uploadPhoto()
    ctx.drive.files.get(drive_file_id).parents = ['some-other-folder']
    const args = { story_id: story, edit_token: token, media_id }
    expect(call('media.finish', { ...args, drive_file_id }).error.code).toBe('upload_failed')
    expect(call('media.finish', { ...args, drive_file_id: 'nosuchfile0000' }).error.code).toBe(
      'upload_failed',
    )
  })

  it('needs the edit token of this story', () => {
    const { media_id, drive_file_id } = uploadPhoto()
    const res = call('media.finish', {
      story_id: story,
      edit_token: 'x'.repeat(40),
      media_id,
      drive_file_id,
    })
    expect(res.error.code).toBe('forbidden')
  })
})

describe('media.startMany and media.finishMany', () => {
  const file = (n, overrides = {}) => ({
    filename: `IMG_${n}.JPG`,
    mime: 'image/jpeg',
    bytes: 2_000_000 + n,
    ...overrides,
  })
  const startMany = (files) =>
    ok('media.startMany', {
      story_id: story,
      edit_token: token,
      origin: 'https://tamar70.web.app',
      files,
    })

  it('opens a session for each file in one call, then confirms them all in one call', () => {
    const { uploads } = startMany([file(1, { caption: 'בים', sort_order: 0 }), file(2), file(3)])
    expect(uploads).toHaveLength(3)
    expect(new Set(uploads.map((u) => u.upload_url)).size).toBe(3)
    const pending = ctx.db.all('Media')
    expect(pending.map((m) => m.upload_status)).toEqual(['pending', 'pending', 'pending'])
    expect(pending[0].caption).toBe('בים')
    // Each session is tied to its own row, like a single start.
    expect(ctx.drive.sessions.get(uploads[1].upload_url).properties.media_id).toBe(
      uploads[1].media_id,
    )

    const items = uploads.map((u) => ({
      media_id: u.media_id,
      drive_file_id: ctx.drive.browserUpload(u.upload_url),
    }))
    const { results } = ok('media.finishMany', { story_id: story, edit_token: token, items })
    expect(results.map((r) => r.ok)).toEqual([true, true, true])
    expect(ctx.db.all('Stories')[0].media_count).toBe(3)

    // Confirming again is harmless.
    const again = ok('media.finishMany', { story_id: story, edit_token: token, items })
    expect(again.results.every((r) => r.ok && r.duplicate)).toBe(true)
  })

  it('reports a session that failed without failing the others', () => {
    ctx.drive.sessionFailures = 1
    const { uploads } = startMany([file(1), file(2)])
    expect(uploads[0]).toEqual({ error: 'upload_failed' })
    expect(uploads[1].upload_url).toBeTruthy()
    expect(ctx.db.all('Media')).toHaveLength(1)
  })

  it('confirms the good files and names the one that could not be checked', () => {
    const { uploads } = startMany([file(1), file(2)])
    const good = ctx.drive.browserUpload(uploads[0].upload_url)
    const { results } = ok('media.finishMany', {
      story_id: story,
      edit_token: token,
      items: [
        { media_id: uploads[0].media_id, drive_file_id: good },
        // A real Drive file, but not the one opened for this row.
        { media_id: uploads[1].media_id, drive_file_id: good },
      ],
    })
    expect(results).toEqual([
      { media_id: uploads[0].media_id, ok: true, width: 4032, height: 3024 },
      { media_id: uploads[1].media_id, ok: false, error: 'upload_failed' },
    ])
    expect(ctx.db.all('Stories')[0].media_count).toBe(1)
  })

  it('keeps the photo limit across the whole batch', () => {
    const tooMany = Array.from({ length: MAX_PHOTOS_PER_STORY + 1 }, (_, i) => file(i))
    const res = call('media.startMany', {
      story_id: story,
      edit_token: token,
      origin: 'https://tamar70.web.app',
      files: tooMany,
    })
    expect(res.error.code).toBe('too_many_photos')
    expect(ctx.db.all('Media')).toHaveLength(0)
  })

  it('is only for the device that owns the story', () => {
    const res = call('media.startMany', {
      story_id: story,
      edit_token: 'x'.repeat(40),
      origin: 'https://tamar70.web.app',
      files: [file(1)],
    })
    expect(res.error.code).toBe('forbidden')
  })
})
