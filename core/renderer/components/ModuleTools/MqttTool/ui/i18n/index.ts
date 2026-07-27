import en, { type MqttMessageKey } from './en';
import zhCN from './zh-CN';

type Locale = 'en' | 'zh-CN';

const LOCALE_SETTING_KEY = 'devtoolbox_locale_setting';

const messages: Record<Locale, Record<MqttMessageKey, string>> = {
  en,
  'zh-CN': zhCN,
};

let activeLocale: Locale = getInitialLocale();

export function setMqttLocale(locale: Locale): void {
  activeLocale = locale;
}

function getInitialLocale(): Locale {
  try {
    const stored = String(localStorage.getItem(LOCALE_SETTING_KEY) ?? '').trim();
    if (stored === 'zh-CN') return 'zh-CN';
    if (stored === 'en') return 'en';
  } catch {
    // ignore
  }
  const nav = typeof navigator !== 'undefined' ? String(navigator.language ?? '') : '';
  return nav.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export function t(key: MqttMessageKey, vars?: Record<string, string>): string {
  const raw = messages[activeLocale]?.[key] ?? messages.en[key] ?? String(key);
  if (!vars) return raw;
  return Object.keys(vars).reduce((acc, k) => acc.split(`{${k}}`).join(vars[k]), raw);
}
