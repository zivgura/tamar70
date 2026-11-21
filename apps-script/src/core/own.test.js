import { SETTING_KEYS } from '@tamar70/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import { handleRequest } from './router.js'
import { writeSetting } from './settings.js'

let ctx
let story
const token = 'o'.repeat(40)
const stranger = 'x'.repeat(40)

const call = (action, payload) => handleRequest(JSON.stringify({ action, payload }), ctx)
const ok = (action, payload) => {
  const res = call(action, payload)
  if (!res.ok) throw new Error(`${action} failed: ${JSON.stringify(res.error)}`)
  return res.data
}

function addPhoto(caption = '') {
  const { media_id, upload_url } = ok('media.start', {
    story_id: story,
    edit_token: token,
    origin: 'https://tamar70.web.app',
    filename: 'p.jpg',
    mime: 'image/jpeg',
    bytes: 1000,
    caption,
  })
  const drive_file_id = ctx.drive.browserUpload(upload_url)
  ok('media.finish', { story_id: story, edit_token: token, media_id, drive_file_id })
  return { media_id, drive_file_id }
}

const edit = (overrides = {}) => ({
  id: story,
  edit_token: token,
  kind: 'mixed',
  author_name: 'ענת',
  author_relation: 'חברה',
  title: 'כותרת חדשה',
  content: 'סיפור מתוקן. עם עוד פרטים.',
  category_id: 'journey',
  ...overrides,
})

beforeEach(() => {
  ctx = createMemoryContext()
  ok('site.get')
  story = ok('stories.submit', {
    edit_token: token,
    kind: 'text',
    author_name: 'ענת',
    title: 'כותרת',
    content: 'סיפור.',
    category_id: 'travels',
    places: ['אילת'],
  }).id
})

describe('stories.getOwn', () => {
  it('returns the whole story and its photos with thumbnails', () => {
    const { drive_file_id } = addPhoto('בים')
    const own = ok('stories.getOwn', { id: story, edit_token: token })
    expect(own).toMatchObject({
      id: story,
      title: 'כותרת',
      content: 'סיפור.',
      category_id: 'travels',
      places: ['אילת'],
    })
    expect(own.photos).toEqual([
      expect.objectContaining({
        caption: 'בים',
        thumbnail: `data:image/png;base64,${drive_file_id}`,
      }),
    ])
    expect(own).not.toHaveProperty('edit_token_hash')
  })

  it('refuses another device', () => {
    expect(call('stories.getOwn', { id: story, edit_token: stranger }).error.code).toBe('forbidden')
  })

  it('refuses once the site is published', () => {
    writeSetting(ctx.db, SETTING_KEYS.SITE_STATUS, 'published')
    expect(call('stories.getOwn', { id: story, edit_token: token }).error.code).toBe(
      'editing_closed',
    )
  })
})

describe('stories.update', () => {
  it('changes the story and its teaser', () => {
    ok('stories.update', edit())
    const [row] = ctx.db.all('Stories')
    expect(row).toMatchObject({
      title: 'כותרת חדשה',
      content: 'סיפור מתוקן. עם עוד פרטים.',
      excerpt: 'סיפור מתוקן.',
      category_id: 'journey',
      author_relation: 'חברה',
    })
    expect(ok('site.bootstrap').stories[0].title).toBe('כותרת חדשה')
  })

  it('refuses another device and keeps the story as it was', () => {
    expect(call('stories.update', edit({ edit_token: stranger })).error.code).toBe('forbidden')
    expect(ctx.db.all('Stories')[0].title).toBe('כותרת')
  })

  it('still needs text unless the story is photos only', () => {
    expect(call('stories.update', edit({ kind: 'text', content: '' })).error.code).toBe(
      'validation',
    )
  })

  it('refuses once the site is published', () => {
    writeSetting(ctx.db, SETTING_KEYS.SITE_STATUS, 'published')
    expect(call('stories.update', edit()).error.code).toBe('editing_closed')
  })
})

describe('stories.delete', () => {
  it('hides the story everywhere and trashes its photos', () => {
    const { drive_file_id } = addPhoto()
    ok('stories.delete', { id: story, edit_token: token })
    expect(ok('site.bootstrap').stories).toHaveLength(0)
    expect(ctx.db.all('Stories')[0].status).toBe('deleted') // kept, not erased
    expect(ctx.db.all('Media')[0].upload_status).toBe('removed')
    expect(ctx.drive.trashed.has(drive_file_id)).toBe(true)
    expect(call('stories.getOwn', { id: story, edit_token: token }).error.code).toBe('forbidden')
  })

  it('refuses another device', () => {
    expect(call('stories.delete', { id: story, edit_token: stranger }).error.code).toBe('forbidden')
    expect(ok('site.bootstrap').stories).toHaveLength(1)
  })
})

describe('media.update / media.remove', () => {
  it('changes a photo’s details', () => {
    const { media_id } = addPhoto('ישן')
    ok('media.update', {
      story_id: story,
      edit_token: token,
      media_id,
      caption: 'חדש',
      year_approx: 1975,
      people: ['אבא'],
    })
    expect(ctx.db.all('Media')[0]).toMatchObject({
      caption: 'חדש',
      year_approx: 1975,
      people: ['אבא'],
    })
  })

  it('removes a photo, trashes it in Drive and recounts', () => {
    const a = addPhoto()
    addPhoto()
    ok('media.remove', { story_id: story, edit_token: token, media_id: a.media_id })
    expect(ok('site.bootstrap').stories[0].media_count).toBe(1)
    expect(ctx.drive.trashed.has(a.drive_file_id)).toBe(true)
    expect(ok('stories.getOwn', { id: story, edit_token: token }).photos).toHaveLength(1)
    expect(
      call('media.remove', { story_id: story, edit_token: token, media_id: a.media_id }).error.code,
    ).toBe('not_found')
  })

  it('frees the slot of a removed photo for a new one', () => {
    const photos = Array.from({ length: 20 }, () => addPhoto())
    ok('media.remove', { story_id: story, edit_token: token, media_id: photos[0].media_id })
    expect(() => addPhoto()).not.toThrow()
  })

  it('refuses another device', () => {
    const { media_id } = addPhoto()
    expect(
      call('media.remove', { story_id: story, edit_token: stranger, media_id }).error.code,
    ).toBe('forbidden')
  })
})
