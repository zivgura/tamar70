import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryContext } from '../testing/memoryContext.js'
import { handleRequest } from './router.js'

let ctx
const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
const call = (url) =>
  handleRequest(JSON.stringify({ action: 'docs.import', payload: { url } }), ctx)

beforeEach(() => {
  ctx = createMemoryContext()
  handleRequest(JSON.stringify({ action: 'site.get' }), ctx)
  ctx.google.docs.set(ID, '﻿הטרמפ לאילת\r\n\r\n\r\nזה היה בקיץ.  \r\n')
})

describe('importing a Google Doc', () => {
  it('returns the text of a doc shared by link', () => {
    const res = call(`https://docs.google.com/document/d/${ID}/edit?usp=sharing`)
    expect(res.data).toEqual({ text: 'הטרמפ לאילת\n\nזה היה בקיץ.' })
  })

  it('accepts links from a second signed-in account', () => {
    expect(call(`https://docs.google.com/document/u/1/d/${ID}/edit`).ok).toBe(true)
  })

  it('says when the doc is not shared', () => {
    expect(
      call('https://docs.google.com/document/d/1PrivatePrivatePrivatePrivate/edit').error.code,
    ).toBe('doc_not_shared')
  })

  it('refuses anything that is not a Google Docs link', () => {
    for (const url of [
      'https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit',
      'https://evil.example/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
      'hello',
      undefined,
    ]) {
      expect(call(url).error.code).toBe('doc_bad_link')
    }
  })
})
