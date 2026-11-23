import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LanguageContext, LANGS, readStoredLang, STORAGE_KEY, translate } from './i18n.js'

function applyToDocument(lang) {
  const root = document.documentElement
  root.lang = lang
  root.dir = lang === LANGS.EN ? 'ltr' : 'rtl'
}

/**
 * Provides the language to everything inside. `force` pins a language for a part of the
 * site (admin), and puts the page back as it was when that part closes.
 */
export function LanguageProvider({ force, children }) {
  const outer = useContext(LanguageContext)
  const [chosen, setChosen] = useState(readStoredLang)
  const lang = force ?? chosen

  const setLang = useCallback((next) => {
    setChosen(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private browsing: the choice lasts for this visit.
    }
  }, [])

  useEffect(() => {
    applyToDocument(lang)
    if (force) return () => applyToDocument(outer.lang)
    return undefined
  }, [lang, force, outer.lang])

  const value = useMemo(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang],
  )
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
