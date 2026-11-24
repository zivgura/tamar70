import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyAdminAppIdentity } from './admin/adminAppIdentity.js'

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

  it('swaps the page to the admin identity and puts the site back afterwards', () => {
    document.head.innerHTML = `
      <link rel="icon" href="/icon.svg" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="apple-mobile-web-app-title" content="תמר 70" />`
    const restore = applyAdminAppIdentity()
    const get = (selector, attr) => document.head.querySelector(selector).getAttribute(attr)
    expect(get('link[rel="manifest"]', 'href')).toBe('/manifest-admin.webmanifest')
    expect(get('link[rel="apple-touch-icon"]', 'href')).toBe('/apple-touch-icon-admin.png')
    expect(get('link[rel="icon"]', 'href')).toBe('/icon-admin.svg')
    expect(get('meta[name="apple-mobile-web-app-title"]', 'content')).toBe('ניהול תמר 70')
    restore()
    expect(get('link[rel="manifest"]', 'href')).toBe('/manifest.webmanifest')
    expect(get('link[rel="apple-touch-icon"]', 'href')).toBe('/apple-touch-icon.png')
    expect(get('link[rel="icon"]', 'href')).toBe('/icon.svg')
    expect(get('meta[name="apple-mobile-web-app-title"]', 'content')).toBe('תמר 70')
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
