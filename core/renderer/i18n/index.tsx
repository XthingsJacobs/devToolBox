import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Locale } from './types';
import enCommon from './locales/en/common';

/**
 * Auto-scan module locales under ModuleTools:
 *   ../components/ModuleTools/{Name}/locales/en.ts
 */
const moduleLocaleFiles = import.meta.glob<{ default: Record<string, string> }>(
  [
    '../components/ModuleTools/*/locales/*.ts',
  ],
  { eager: true },
);

/** Aggregate module translations by locale from glob results */
function buildModuleMessages(): Record<Locale, Record<string, Record<string, string>>> {
  const result: Record<Locale, Record<string, Record<string, string>>> = { en: {} };
  for (const [filePath, mod] of Object.entries(moduleLocaleFiles)) {
    // Example path: ../components/ModuleTools/Base64Codec/locales/en.ts
    const parts = filePath.split('/');
    const locale = parts[parts.length - 1].replace('.ts', '') as Locale;
    const folderName = parts[parts.length - 3]; // e.g. "Base64Codec"
    if (locale === 'en' && folderName) result[locale][folderName] = mod.default;
  }
  return result;
}

const moduleMessages = buildModuleMessages();

type MessageTree = Record<string, unknown>;

const messages: Record<Locale, MessageTree> = {
  en: enCommon as MessageTree,
};

const LOCALE_KEY = 'devtoolbox_locale';

function getDefaultLocale(): Locale {
  localStorage.setItem(LOCALE_KEY, 'en');
  return 'en';
}

/** Read nested values by dot-path */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getByPath(obj: unknown, path: string): string {
  const keys = path.split('.');
  let cur: unknown = obj;
  for (const k of keys) {
    if (!isRecord(cur)) return path;
    cur = cur[k];
  }
  return typeof cur === 'string' ? cur : path;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getDefaultLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(LOCALE_KEY, l);
    void window.electronAPI?.setLocale(l);
  }, []);

  useEffect(() => {
    const handler = (_event: unknown, newLocale: string) => {
      if (newLocale === 'en') setLocaleState('en');
    };
    window.electronAPI?.onLocaleChanged(handler);
    return () => {
      window.electronAPI?.offLocaleChanged(handler);
    };
  }, []);

  const t = useCallback(
    (key: string): string => {
      return getByPath(messages[locale], key);
    },
    [locale],
  );

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/**
 * Find module locale data by folder name, e.g. "Base64Codec".
 */
export function getModuleLocale(locale: Locale, folderName: string): Record<string, string> | undefined {
  return moduleMessages[locale]?.[folderName];
}

/** Get localized category name */
export function getCategoryName(locale: Locale, categoryId: string): string {
  const node = messages[locale]['categories'];
  if (!isRecord(node)) return categoryId;
  return typeof node[categoryId] === 'string' ? node[categoryId] : categoryId;
}
