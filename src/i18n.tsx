/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, { useCallback, useMemo, useState, type ReactNode } from 'react'
import { getInitialLang, getTranslationDictionary, I18nContext, LANG_STORAGE_KEY } from './i18nContext'
import type { Lang } from './translations'

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(getInitialLang)

  const setLang = useCallback((nextLang: Lang) => {
    setLangState(nextLang)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, nextLang)
      } catch {
        // ignore
      }
    }
  }, [])

  const toggleLang = useCallback(() => {
    setLang(lang === 'zh' ? 'en' : 'zh')
  }, [lang, setLang])

  const t = useCallback((key: string) => {
    const dictionary = getTranslationDictionary(lang)
    return dictionary[key] ?? key
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}
