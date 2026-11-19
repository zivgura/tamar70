import { describe, expect, it } from 'vitest'
import { decodeRow, encodeRow } from './codec.js'
import { TABLES } from './tables.js'

const headers = TABLES.Stories.map((c) => c.name)

describe('encodeRow / decodeRow', () => {
  it('round-trips typed values through text cells', () => {
    const story = {
      id: 'st_abc123',
      title: 'שלום',
      decade: 1970,
      featured: true,
      places: ['ירושלים', 'Paris'],
      people: [],
    }
    const row = encodeRow('Stories', headers, story)
    expect(row.every((c) => typeof c === 'string')).toBe(true)
    const back = decodeRow('Stories', headers, row)
    expect(back).toMatchObject(story)
    expect(back.year_approx).toBeNull()
    expect(back.tags).toEqual([])
  })

  it('escapes text that Sheets would treat as a formula', () => {
    const row = encodeRow('Stories', headers, { title: '=HYPERLINK("x")', content: '-5 points' })
    expect(row[headers.indexOf('title')]).toBe(`'=HYPERLINK("x")`)
    expect(row[headers.indexOf('content')]).toBe(`'-5 points`)
  })

  it('follows the Sheet column order and ignores unknown columns', () => {
    const sheetHeaders = ['title', 'mystery', 'id']
    expect(encodeRow('Stories', sheetHeaders, { id: 'st_1', title: 'T' })).toEqual([
      'T',
      '',
      'st_1',
    ])
    expect(decodeRow('Stories', sheetHeaders, ['T', 'x', 'st_1'])).toMatchObject({
      id: 'st_1',
      title: 'T',
    })
  })

  it('reads values Sheets converted on its own', () => {
    const row = Array(headers.length).fill('')
    row[headers.indexOf('created_at')] = new Date('2026-12-01T10:00:00Z')
    row[headers.indexOf('decade')] = 1980
    row[headers.indexOf('featured')] = true
    row[headers.indexOf('places')] = 'not json'
    const s = decodeRow('Stories', headers, row)
    expect(s.created_at).toBe('2026-12-01T10:00:00.000Z')
    expect(s.decade).toBe(1980)
    expect(s.featured).toBe(true)
    expect(s.places).toEqual([])
  })
})
