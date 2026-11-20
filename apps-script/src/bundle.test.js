// Runs the real bundle (dist/Code.js) the way Apps Script does: one classic script in a shared
// global scope, entry points called by name. Covers what unit tests can't: the esbuild output,
// the Sheets adapter and zod surviving the bundle.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import vm from 'node:vm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildBundle, ENTRY_POINTS } from '../build.js'
import { createFakeGas } from './testing/fakeGas.js'

let code
let gas
let script

beforeAll(async () => {
  const file = await buildBundle(mkdtempSync(join(tmpdir(), 'tamar70-bundle-')))
  code = readFileSync(file, 'utf8')
}, 30_000)

beforeEach(() => {
  gas = createFakeGas()
  script = vm.createContext({ ...gas.globals })
  vm.runInContext(code, script, { filename: 'Code.js' })
})

const post = (body) =>
  JSON.parse(script.doPost({ postData: { contents: JSON.stringify(body) } }).content)

describe('bundle', () => {
  it('declares every entry point as a global function', () => {
    for (const name of ENTRY_POINTS) expect(typeof script[name]).toBe('function')
  })

  it('answers the health check', () => {
    const res = script.doGet()
    expect(res.mime).toBe('application/json')
    expect(JSON.parse(res.content)).toEqual({
      ok: true,
      data: { service: 'tamar70', schema_version: 0 },
    })
  })

  it('builds the Sheet on the first request and removes the blank tab', () => {
    expect(post({ action: 'site.get' }).ok).toBe(true)
    const names = gas.spreadsheet.getSheets().map((s) => s.getName())
    expect(names).toContain('Stories')
    expect(names).not.toContain('Sheet1')
    expect(gas.spreadsheet.getSheetByName('Stories').cells[0]).toContain('edit_token_hash')
  })

  it('takes a submission end to end through the Sheet', () => {
    script.rotateFamilyCode()
    const code = gas.logs
      .map(([, msg]) => msg)
      .find((m) => m.startsWith('New family code: '))
      .slice('New family code: '.length)

    const submitted = post({
      action: 'stories.submit',
      payload: {
        edit_token: 'a'.repeat(40),
        family_code: code,
        kind: 'text',
        author_name: 'דני',
        title: '=1+1',
        content: 'שורה ראשונה. שורה שנייה.',
        decade: 1980,
        places: ['חיפה'],
      },
    })
    expect(submitted.ok).toBe(true)

    const list = post({ action: 'stories.list' })
    expect(list.data.stories).toEqual([
      expect.objectContaining({
        id: submitted.data.id,
        view: 'teaser',
        title: '=1+1',
        excerpt: 'שורה ראשונה.',
        author_name: 'דני',
      }),
    ])
    expect(list.data.stories[0]).not.toHaveProperty('content')
  })

  it('returns validation errors from zod inside the bundle', () => {
    const res = post({ action: 'stories.submit', payload: { kind: 'text' } })
    expect(res.ok).toBe(false)
    expect(res.error.code).toBe('validation')
  })

  it('fails safely when the Sheet is not set up', () => {
    gas.properties.delete('SHEET_ID')
    expect(post({ action: 'site.get' })).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Something went wrong' },
    })
  })
})
