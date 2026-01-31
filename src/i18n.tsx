/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import TRANSLATIONS, { Lang } from "./translations";

const LANG_STORAGE_KEY = "exia-analysis-lang";

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 检测浏览器语言
const detectBrowserLanguage = (): Lang => {
  if (typeof navigator === "undefined") return "zh";
  const browserLang =
    navigator.language || (navigator as any).userLanguage || "";
  // 如果浏览器语言以 zh 开头（如 zh-CN, zh-TW）则返回 'zh'，否则返回 'en'
  return browserLang.toLowerCase().startsWith("zh") ? "zh" : "en";
};

// 获取初始语言
const getInitialLang = (): Lang => {
  if (typeof window === "undefined") return "zh";
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === "zh" || stored === "en") {
      return stored;
    }
    // 首次访问，自动检测浏览器语言
    const detected = detectBrowserLanguage();
    window.localStorage.setItem(LANG_STORAGE_KEY, detected);
    return detected;
  } catch {
    return detectBrowserLanguage();
  }
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, l);
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "zh" ? "en" : "zh");
  }, [lang, setLang]);

  const t = useCallback(
    (key: string) => {
      const dict = TRANSLATIONS[lang] || TRANSLATIONS.zh;
      return dict[key] ?? key;
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
