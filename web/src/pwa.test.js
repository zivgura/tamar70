import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toAdminHtml } from '../vite-plugins/adminHtml.js'

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

describe('the admin app', () => {
  const admin = JSON.parse(read('public/manifest-admin.webmanifest'))

  it('has its own manifest that starts at, and stays inside, /admin', () => {
    expect(admin).toMatchObject({
      id: '/admin',
      start_url: '/admin',
      scope: '/admin',
      lang: 'he',
      dir: 'rtl',
      display: 'standalone',
    })
    expect(admin.name).not.toBe(manifest.name)
    expect(admin.short_name.length).toBeLessThanOrEqual(14)
    for (const icon of admin.icons) {
      expect(existsSync(file(`public${icon.src}`)), icon.src).toBe(true)
    }
    expect(admin.icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it('has its own page, with the admin tags already in the HTML the phone first loads', () => {
    const built = `${read('index.html').replace('</head>', '<script>window.__tamar70Boot=fetch("x",{a:1}).then(function(r){return r})</script></head>')}`
    const html = toAdminHtml(built)
    expect(html).toContain('<link rel="manifest" href="/manifest-admin.webmanifest" />')
    expect(html).toContain('rel="apple-touch-icon" href="/apple-touch-icon-admin.png"')
    expect(html).toContain('rel="icon" type="image/svg+xml" href="/icon-admin.svg"')
    expect(html).toContain('name="apple-mobile-web-app-title" content="ניהול תמר 70"')
    expect(html).toContain('<title>ניהול האתר – תמר בת 70</title>')
    // Nothing of the public identity is left, and the home page's API call isn't repeated.
    expect(html).not.toContain('manifest.webmanifest')
    expect(html).not.toContain('"/icon.svg"')
    expect(html).not.toContain('__tamar70Boot')
    expect(html).toContain('<script type="module" src="/src/main.jsx"></script>')
  })

  it('fails the build, loudly, if index.html no longer has the tags it swaps', () => {
    expect(() => toAdminHtml('<html><head></head></html>')).toThrow(/admin\.html/)
  })

  it('is served for /admin and below by the host, before the catch-all', () => {
    const { rewrites } = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../firebase.json'), 'utf8'),
    ).hosting
    const sources = rewrites.map((r) => r.source)
    expect(rewrites.filter((r) => r.destination === '/admin.html').map((r) => r.source)).toEqual([
      '/admin',
      '/admin/**',
    ])
    expect(sources.indexOf('/admin/**')).toBeLessThan(sources.indexOf('**'))
    expect(rewrites.at(-1)).toEqual({ source: '**', destination: '/index.html' })
  })

  it('points at files that exist', () => {
    for (const path of [
      'icon-admin.svg',
      'apple-touch-icon-admin.png',
      'manifest-admin.webmanifest',
    ]) {
      expect(existsSync(file(`public/${path}`)), path).toBe(true)
    }
  })
})
