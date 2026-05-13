import type { Locale } from '../i18n/types';
import type { MarketplacePluginManifest } from './types';

type I18nBlock = { name?: string; description?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function getMarketplaceManifestText(manifest: MarketplacePluginManifest, locale: Locale): { name: string; description: string } {
  const i18n = manifest.i18n;
  if (i18n && isRecord(i18n)) {
    const block = i18n[locale] as unknown;
    if (isRecord(block)) {
      const name = typeof block.name === 'string' && block.name.trim() ? block.name : undefined;
      const description = typeof block.description === 'string' ? block.description : undefined;
      if (name || description) {
        return { name: name ?? manifest.name, description: description ?? manifest.description };
      }
    }
  }
  return { name: manifest.name, description: manifest.description };
}

