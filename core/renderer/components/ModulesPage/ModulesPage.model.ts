import type {
  InstalledMarketplacePlugin,
  MarketplaceRegistry,
  MarketplaceRegistryEntry,
} from '../../marketplace/types';
import { getMarketplaceManifestText } from '../../marketplace/i18n';
import { compareVersions, isNewerVersion } from '../../marketplace/version';
import type { Locale } from '@devtoolbox/core';

export type TabId = 'installed' | 'marketplace';

export type UpgradeEntry = {
  inst: InstalledMarketplacePlugin;
  latest: MarketplaceRegistryEntry;
};

export function isLocalMarketplaceEntry(entry: MarketplaceRegistryEntry): boolean {
  return typeof entry.downloadUrl === 'string' && entry.downloadUrl.startsWith('file:');
}

export function metadataList(values?: string[]): string {
  return values?.length ? values.join(', ') : 'none';
}

export function marketplaceModuleCategoryColor(categoryId: string): string {
  switch (categoryId) {
    case 'dev-tools':
      return 'var(--cat-dev)';
    case 'text-tools':
      return 'var(--cat-text)';
    case 'network-tools':
      return 'var(--cat-network)';
    case 'security-tools':
      return 'var(--cat-security)';
    case 'other-tools':
      return 'var(--cat-other)';
    default:
      return 'var(--accent-secondary)';
  }
}

export function buildRegistryLatestMap(registry: MarketplaceRegistry): Map<string, MarketplaceRegistryEntry> {
  const latestById = new Map<string, MarketplaceRegistryEntry>();

  for (const entry of registry.plugins) {
    const id = entry.manifest?.id;
    if (!id) continue;

    const current = latestById.get(id);
    if (!current) {
      latestById.set(id, entry);
      continue;
    }

    const nextVersion = String(entry.manifest?.version ?? '');
    const currentVersion = String(current.manifest?.version ?? '');
    if (compareVersions(nextVersion, currentVersion) > 0) latestById.set(id, entry);
  }

  return latestById;
}

export function buildModuleCategories({
  activeTab,
  installed,
  marketplaceLatest,
}: {
  activeTab: TabId;
  installed: InstalledMarketplacePlugin[];
  marketplaceLatest: MarketplaceRegistryEntry[];
}): string[] {
  const list =
    activeTab === 'installed'
      ? installed
      : marketplaceLatest.map((entry) => ({ manifest: entry.manifest }) as InstalledMarketplacePlugin);
  const unique = Array.from(new Set(list.map((item) => item.manifest.categoryId).filter(Boolean))).sort();
  return ['All', ...unique];
}

export function buildUpgradeEntries(
  installed: InstalledMarketplacePlugin[],
  registryLatestMap: Map<string, MarketplaceRegistryEntry>,
): UpgradeEntry[] {
  const result: UpgradeEntry[] = [];

  for (const plugin of installed) {
    const latest = registryLatestMap.get(plugin.id);
    if (!latest) continue;
    if (isNewerVersion(String(latest.manifest.version ?? ''), String(plugin.version ?? ''))) {
      result.push({ inst: plugin, latest });
    }
  }

  return result;
}

export function hasPluginUpdate(
  installedVersion: string | undefined,
  latestEntry: MarketplaceRegistryEntry | undefined,
): boolean {
  return latestEntry
    ? isNewerVersion(String(latestEntry.manifest.version ?? ''), String(installedVersion ?? ''))
    : false;
}

export function filterInstalledPlugins({
  installed,
  query,
  category,
  locale,
}: {
  installed: InstalledMarketplacePlugin[];
  query: string;
  category: string;
  locale: Locale;
}): InstalledMarketplacePlugin[] {
  const normalizedQuery = query.trim().toLowerCase();

  return installed.filter((plugin) => {
    const text = getMarketplaceManifestText(plugin.manifest, locale);
    const matchQuery =
      !normalizedQuery ||
      text.name.toLowerCase().includes(normalizedQuery) ||
      text.description.toLowerCase().includes(normalizedQuery);
    const matchCategory = category === 'All' || plugin.manifest.categoryId === category;
    return matchQuery && matchCategory;
  });
}

export function filterMarketplaceEntries({
  marketplaceLatest,
  query,
  category,
  localOnly,
  locale,
}: {
  marketplaceLatest: MarketplaceRegistryEntry[];
  query: string;
  category: string;
  localOnly: boolean;
  locale: Locale;
}): MarketplaceRegistryEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return marketplaceLatest.filter((entry) => {
    const text = getMarketplaceManifestText(entry.manifest, locale);
    const matchQuery =
      !normalizedQuery ||
      text.name.toLowerCase().includes(normalizedQuery) ||
      text.description.toLowerCase().includes(normalizedQuery);
    const matchCategory = category === 'All' || entry.manifest.categoryId === category;
    const matchLocal = !localOnly || isLocalMarketplaceEntry(entry);
    return matchQuery && matchCategory && matchLocal;
  });
}
