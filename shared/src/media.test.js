import { describe, expect, it } from 'vitest'
import { isSiteOrigin, MAX_PHOTO_BYTES, mediaStartSchema, safeFilename } from './media.js'

const start = {
  story_id: 'st_abc123def',
  edit_token: 'a'.repeat(40),
  origin: 'https://tamar70.web.app',
  filename: 'IMG_0001.JPG',
  mime: 'image/jpeg',
  bytes: 3_000_000,
}

describe('isSiteOrigin', () => {
  it.each([
    'https://tamar70.web.app',
    'https://tamar70.firebaseapp.com',
    'https://tamar70--pr6-milestone-3-upload-abc123.web.app',
    'http://localhost:5173',
  ])('accepts %s', (o) => expect(isSiteOrigin(o)).toBe(true))

  it.each([
    'https://evil.web.app',
    'https://tamar70.web.app.evil.com',
    'http://tamar70.web.app',
    'https://tamar70.web.app/',
    'http://localhost:3000',
    '',
    undefined,
  ])('rejects %s', (o) => expect(isSiteOrigin(o)).toBe(false))
})

describe('mediaStartSchema', () => {
  it('accepts a normal photo', () => {
    expect(mediaStartSchema.parse(start)).toMatchObject({ caption: '', people: [] })
  })

  it('rejects files over the size cap', () => {
    expect(mediaStartSchema.safeParse({ ...start, bytes: MAX_PHOTO_BYTES + 1 }).success).toBe(false)
  })

  it('rejects types that are not photos', () => {
    expect(mediaStartSchema.safeParse({ ...start, mime: 'application/pdf' }).success).toBe(false)
  })

  it('rejects an origin that is not the site', () => {
    expect(mediaStartSchema.safeParse({ ...start, origin: 'https://evil.com' }).success).toBe(false)
  })
})

describe('safeFilename', () => {
  it('drops folders and control characters', () => {
    expect(safeFilename('../../etc/IMG\u0000_1.jpg')).toBe('IMG_1.jpg')
    expect(safeFilename('C:\\photos\\חתונה.jpg')).toBe('חתונה.jpg')
  })

  it('never returns an empty name', () => {
    expect(safeFilename('  ')).toBe('photo')
  })
})
