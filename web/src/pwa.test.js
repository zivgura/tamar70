import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// web/src/ -> web/ (import.meta.url is not a file address in the jsdom test environment)
const file = (path) => join(import.meta.dirname, '..', path)
const read = (path) => readFileSync(file(path), 'utf8')
const manifest = JSON.parse(read('public/manifest.webmanifest'))

describe('the installable app (PWA)', () => {
  it('has a Hebrew, right-to-left manifest that opens full screen at the site root', () => {
    expect(manifest).toMatchObject({
      lang: 'he',
      dir: 'rtl',
      start_url: '/',
      display: 'standalone',
    })
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name.length).toBeLessThanOrEqual(12)
  })

  it('lists icons that exist, including a maskable one', () => {
    for (const icon of manifest.icons) {
      expect(existsSync(file(`public${icon.src}`)), icon.src).toBe(true)
    }
    const sizes = manifest.icons.map((i) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it('uses the site background color from the design tokens', () => {
    const tokens = read('src/theme/tokens.css')
    const cream = tokens.match(/--palette-cream-100:\s*(#[0-9a-f]{6})/i)?.[1]
    expect(cream).toBeTruthy()
    expect(manifest.background_color).toBe(cream)
    expect(manifest.theme_color).toBe(cream)
    expect(read('index.html')).toContain(`<meta name="theme-color" content="${cream}" />`)
  })

  it('is linked from index.html, with the icons for tabs and the iPhone home screen', () => {
    const html = read('index.html')
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon.png"')
    expect(html).toContain('rel="icon" type="image/svg+xml" href="/icon.svg"')
    expect(existsSync(file('public/icon.svg'))).toBe(true)
    expect(existsSync(file('public/apple-touch-icon.png'))).toBe(true)
  })
})
