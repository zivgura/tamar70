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

// English texts for the site's own corners, used when the Sheet has none (an older server,
// or an empty *_en cell). The Sheet's columns win, so they can still be edited there.
const CORNERS_EN = {
  journey: [
    'A Journey Through Time',
    'Childhood, youth, meaningful moments and family stories',
    'Tell us about something you shared in the past',
  ],
  protest: [
    'Political Protests',
    'Stories, experiences and people from the protests Tamar took part in',
    'Which protest were you at with Tamar?',
  ],
  travels: [
    'Trips in Israel and Abroad',
    'Adventures, trips and special places',
    'Where did you travel together, and what happened there?',
  ],
  culture: [
    'Culture',
    "Books, music, plays, films and art in Tamar's life",
    'Which book, show or film does Tamar always talk about?',
  ],
  sayings: [
    "Tamar's Sayings",
    'Phrases, expressions and things Tamar always says',
    'What does Tamar always say when...?',
  ],
  'did-you-know': [
    "Things You Didn't Know About Tamar",
    'Surprising facts, hidden talents, habits and funny anecdotes',
    'What do only a few people know about Tamar?',
  ],
  wishes: [
    'A Few Words for Tamar',
    'Wishes, blessings and appreciation',
    'What would you like to wish Tamar?',
  ],
  general: [
    'Not sure – general',
    "Anything that doesn't fit another corner",
    'Share any story, saying or photo',
  ],
}

/** A corner's name, description and prompt in the current language (Hebrew if none). */
export function localCategory(category, lang) {
  if (!category || lang !== LANGS.EN) return category
  const [name, description, prompt] = CORNERS_EN[category.id] ?? []
  return {
    ...category,
    name: category.name_en || name || category.name,
    description: category.description_en || description || category.description,
    prompt_hint: category.prompt_hint_en || prompt || category.prompt_hint,
  }
}
