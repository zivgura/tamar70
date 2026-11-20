import { MAX_PHOTOS_PER_STORY, SETTING_KEYS } from '@tamar70/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import { rotateFamilyCode } from './familyCode.js'
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
  const { code } = rotateFamilyCode(ctx)
  story = ok('stories.submit', {
    edit_token: token,
    family_code: code,
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
