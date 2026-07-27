import type { Locale } from '../i18n/types';
import type { MarketplacePluginManifest } from './types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function readManifestText(block: unknown): { name?: string; description?: string } | undefined {
  if (!isRecord(block)) return undefined;
  const name = typeof block.name === 'string' && block.name.trim() ? block.name : undefined;
  const description = typeof block.description === 'string' ? block.description : undefined;
  if (!name && description === undefined) return undefined;
  return { name, description };
}

export function getMarketplaceManifestText(
  manifest: MarketplacePluginManifest,
  locale: Locale,
): { name: string; description: string } {
  const i18n = manifest.i18n;
  if (i18n && isRecord(i18n)) {
    const localized = readManifestText(i18n[locale]);
    if (localized) {
      return { name: localized.name ?? manifest.name, description: localized.description ?? manifest.description };
    }
    const english = readManifestText(i18n.en);
    if (english) {
      return { name: english.name ?? manifest.name, description: english.description ?? manifest.description };
    }
  }
  return { name: manifest.name, description: manifest.description };
}
