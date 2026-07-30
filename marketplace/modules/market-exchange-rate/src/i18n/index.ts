import type { PluginLocale } from '@devtoolbox/plugin-sdk/react';
import en, { type MessageKey } from './en';
import zhCN from './zh-CN';

const messages: Record<PluginLocale, Record<MessageKey, string>> = {
  en,
  'zh-CN': zhCN,
};

export function t(locale: PluginLocale, key: MessageKey, vars?: Record<string, string | number>): string {
  const raw = messages[locale]?.[key] ?? messages.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce((out, [name, value]) => out.split(`{${name}}`).join(String(value)), raw);
}
