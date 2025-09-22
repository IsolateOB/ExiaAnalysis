import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback } from 'react'
import TRANSLATIONS, { Lang } from './translations'

type I18nContextType = {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('zh')

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))
  }, [])

  const t = useCallback((key: string) => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.zh
    return dict[key] ?? key
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, toggleLang, t }), [lang, toggleLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
