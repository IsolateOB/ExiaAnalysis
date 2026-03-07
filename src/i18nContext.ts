/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { createContext } from 'react'
import TRANSLATIONS, { type Lang } from './translations'

export const LANG_STORAGE_KEY = 'exia-analysis-lang'

type BrowserNavigator = Navigator & {
  userLanguage?: string
}

export type I18nContextType = {
  lang: Lang
  setLang: (lang: Lang) => void
  toggleLang: () => void
  t: (key: string) => string
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined)

export const detectBrowserLanguage = (): Lang => {
  if (typeof navigator === 'undefined') return 'zh'
  const browserNavigator = navigator as BrowserNavigator
  const browserLang = browserNavigator.language || browserNavigator.userLanguage || ''
  return browserLang.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const getInitialLang = (): Lang => {
  if (typeof window === 'undefined') return 'zh'
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') {
      return stored
    }
    const detected = detectBrowserLanguage()
    window.localStorage.setItem(LANG_STORAGE_KEY, detected)
    return detected
  } catch {
    return detectBrowserLanguage()
  }
}

export const getTranslationDictionary = (lang: Lang) => TRANSLATIONS[lang] || TRANSLATIONS.zh
