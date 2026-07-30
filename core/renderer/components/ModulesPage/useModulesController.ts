import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InstalledMarketplacePlugin, MarketplaceRegistryEntry } from '../../marketplace/types';
import {
  DEFAULT_MARKETPLACE_REGISTRY_URL,
  fetchMarketplaceRegistry,
  getBundledRegistry,
  loadMarketplaceRegistryUrl,
} from '../../marketplace/registry';
import {
  installPlugin,
  listInstalledPlugins,
  setPluginEnabled,
  uninstallPlugin,
} from '../../marketplace/api';
import type { Locale } from '@devtoolbox/core';
import {
  buildModuleCategories,
  buildRegistryLatestMap,
  buildUpgradeEntries,
  filterInstalledPlugins,
  filterMarketplaceEntries,
  type TabId,
} from './ModulesPage.model';

export function useModulesController({
  locale,
  onUpdated,
}: {
  locale: Locale;
  onUpdated?: (installed: InstalledMarketplacePlugin[]) => void;
}) {
  const bundledRegistry = useMemo(() => getBundledRegistry(), []);
  const [activeTab, setActiveTab] = useState<TabId>('installed');
  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [localOnly, setLocalOnly] = useState(false);
  const [registry, setRegistry] = useState(bundledRegistry);
  const [installed, setInstalled] = useState<InstalledMarketplacePlugin[]>([]);
  const [error, setError] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshInstalled = useCallback(async () => {
    setError('');
    try {
      const list = await listInstalledPlugins();
      setInstalled(list);
      onUpdated?.(list);
    } catch (errorValue: unknown) {
      setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
    }
  }, [onUpdated]);

  const refreshRegistry = useCallback(
    async (options?: { force?: boolean }) => {
      const url = loadMarketplaceRegistryUrl() || DEFAULT_MARKETPLACE_REGISTRY_URL;
      try {
        const remote = await fetchMarketplaceRegistry(url, options);
        setRegistry(remote);
      } catch (errorValue: unknown) {
        setRegistry(bundledRegistry);
        setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
      }
    },
    [bundledRegistry],
  );

  const refreshAll = useCallback(
    async (options?: { force?: boolean }) => {
      setRefreshing(true);
      await refreshInstalled();
      await refreshRegistry(options);
      setRefreshing(false);
    },
    [refreshInstalled, refreshRegistry],
  );

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const registryLatestMap = useMemo(() => buildRegistryLatestMap(registry), [registry]);
  const marketplaceLatest = useMemo(() => Array.from(registryLatestMap.values()), [registryLatestMap]);
  const installedMap = useMemo(() => new Map(installed.map((plugin) => [plugin.id, plugin])), [installed]);
  const cats = useMemo(
    () => buildModuleCategories({ activeTab, installed, marketplaceLatest }),
    [activeTab, installed, marketplaceLatest],
  );
  const upgradeEntries = useMemo(
    () => buildUpgradeEntries(installed, registryLatestMap),
    [installed, registryLatestMap],
  );
  const filteredInstalled = useMemo(
    () => filterInstalledPlugins({ installed, query, category: filterCat, locale }),
    [filterCat, installed, locale, query],
  );
  const filteredMarketplace = useMemo(
    () =>
      filterMarketplaceEntries({
        marketplaceLatest,
        query,
        category: filterCat,
        localOnly,
        locale,
      }),
    [filterCat, localOnly, locale, marketplaceLatest, query],
  );

  const handleInstall = useCallback(
    async (entry: MarketplaceRegistryEntry) => {
      setError('');
      setInstallingId(entry.manifest.id);
      try {
        const result = await installPlugin(entry);
        if (!result.success) setError(result.error ?? 'Install failed');
      } catch (errorValue: unknown) {
        setError(errorValue instanceof Error ? errorValue.message : String(errorValue));
      } finally {
        setInstallingId(null);
        await refreshInstalled();
      }
    },
    [refreshInstalled],
  );

  const handleUninstall = useCallback(
    async (id: string) => {
      setError('');
      const result = await uninstallPlugin(id);
      if (!result.success) setError(result.error ?? 'Uninstall failed');
      await refreshInstalled();
    },
    [refreshInstalled],
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      setError('');
      const result = await setPluginEnabled(id, enabled);
      if (!result.success) setError(result.error ?? 'Update failed');
      await refreshInstalled();
    },
    [refreshInstalled],
  );

  const handleUpgradeAll = useCallback(async () => {
    for (const { latest } of upgradeEntries) {
      await handleInstall(latest);
    }
  }, [handleInstall, upgradeEntries]);

  return {
    activeTab,
    setActiveTab,
    query,
    setQuery,
    filterCat,
    setFilterCat,
    localOnly,
    setLocalOnly,
    installed,
    installedMap,
    marketplaceLatest,
    registryLatestMap,
    cats,
    upgradeEntries,
    filteredInstalled,
    filteredMarketplace,
    error,
    installingId,
    refreshing,
    refreshAll,
    handleInstall,
    handleUninstall,
    handleToggle,
    handleUpgradeAll,
  };
}
