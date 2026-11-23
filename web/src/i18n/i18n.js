import { createContext, useContext } from 'react'
import { en } from './en.js'
import { he } from './he.js'

// The public site speaks Hebrew (default) or English. The choice is kept on the device, and
// a link with ?lang=en opens the English site. Admin pages are always Hebrew (see
// LanguageProvider's `force`).

export const LANGS = Object.freeze({ HE: 'he', EN: 'en' })
const DICTIONARIES = { he, en }
export const STORAGE_KEY = 'tamar70.lang'

export function readStoredLang() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang')
    if (fromUrl === LANGS.EN || fromUrl === LANGS.HE) {
      window.localStorage.setItem(STORAGE_KEY, fromUrl) // a shared English link sticks
      return fromUrl
    }
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === LANGS.EN ? LANGS.EN : LANGS.HE
  } catch {
    return LANGS.HE
  }
}

/** Fills {name} placeholders, or calls a function entry with `vars`. */
export function translate(lang, key, vars = {}) {
  const entry = DICTIONARIES[lang]?.[key] ?? he[key]
  if (entry === undefined) return key
  if (typeof entry === 'function') return entry(vars)
  return entry.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''))
}

export const LanguageContext = createContext({
  lang: LANGS.HE,
  setLang: () => {},
  t: (key, vars) => translate(LANGS.HE, key, vars),
})

export const useLang = () => useContext(LanguageContext)

/** A corner's name, description and prompt in the current language (Hebrew if none). */
export function localCategory(category, lang) {
  if (!category || lang !== LANGS.EN) return category
  return {
    ...category,
    name: category.name_en || category.name,
    description: category.description_en || category.description,
    prompt_hint: category.prompt_hint_en || category.prompt_hint,
  }
}
