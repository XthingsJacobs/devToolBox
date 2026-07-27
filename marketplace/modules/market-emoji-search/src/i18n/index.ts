import type { PluginLocale } from '@devtoolbox/plugin-sdk/react';
import en, { type MessageKey } from './en';
import zhCN from './zh-CN';

const messages: Record<PluginLocale, Record<MessageKey, string>> = {
  en,
  'zh-CN': zhCN,
};

export function t(locale: PluginLocale, key: MessageKey): string {
  return messages[locale]?.[key] ?? messages.en[key] ?? key;
}
