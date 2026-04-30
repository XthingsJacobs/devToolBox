import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './PluginManager.module.css';
import type { InstalledMarketplacePlugin, MarketplaceRegistry, MarketplaceRegistryEntry } from '../../marketplace/types';
import {
  DEFAULT_MARKETPLACE_REGISTRY_URL,
  fetchMarketplaceRegistry,
  getBundledRegistry,
  loadMarketplaceRegistryUrl,
} from '../../marketplace/registry';
import { installPlugin, listInstalledPlugins, setPluginEnabled, uninstallPlugin } from '../../marketplace/api';

interface PluginManagerProps {
  onUpdated?: (installed: InstalledMarketplacePlugin[]) => void;
}

type TabId = 'installed' | 'marketplace';

export default function PluginManager({ onUpdated }: PluginManagerProps) {
  const bundledRegistry = useMemo(() => getBundledRegistry(), []);
  const [activeTab, setActiveTab] = useState<TabId>('installed');
  const [query, setQuery] = useState('');
  const [registry, setRegistry] = useState<MarketplaceRegistry>(bundledRegistry);
  const [installed, setInstalled] = useState<InstalledMarketplacePlugin[]>([]);
  const [error, setError] = useState('');
  const [installingId, setInstallingId] = useState<string | null>(null);

  const refreshInstalled = useCallback(async () => {
    setError('');
    try {
      const list = await listInstalledPlugins();
      setInstalled(list);
      onUpdated?.(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onUpdated]);

  const refreshRegistry = useCallback(async () => {
    const url = loadMarketplaceRegistryUrl() || DEFAULT_MARKETPLACE_REGISTRY_URL;
    try {
      const remote = await fetchMarketplaceRegistry(url);
      setRegistry(remote);
    } catch (e: unknown) {
      setRegistry(bundledRegistry);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [bundledRegistry]);

  const refreshAll = useCallback(async () => {
    await refreshInstalled();
    await refreshRegistry();
  }, [refreshInstalled, refreshRegistry]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const handler = () => void refreshRegistry();
    window.addEventListener('devtoolbox:registryUrlChanged', handler);
    return () => window.removeEventListener('devtoolbox:registryUrlChanged', handler);
  }, [refreshRegistry]);

  const q = query.trim().toLowerCase();
  const installedFiltered = useMemo(
    () => (q ? installed.filter((p) => String(p.manifest?.name ?? '').toLowerCase().includes(q)) : installed),
    [installed, q],
  );
  const registryFiltered = useMemo(
    () => (q ? registry.plugins.filter((e) => String(e.manifest?.name ?? '').toLowerCase().includes(q)) : registry.plugins),
    [registry.plugins, q],
  );

  const installedMap = useMemo(() => new Map(installed.map((p) => [p.id, p])), [installed]);

  const handleInstall = useCallback(
    async (entry: MarketplaceRegistryEntry) => {
      setError('');
      const id = entry.manifest.id;
      setInstallingId(id);
      try {
        const res = await installPlugin(entry);
        if (!res.success) setError(res.error ?? 'Install failed');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
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
      const res = await uninstallPlugin(id);
      if (!res.success) setError(res.error ?? 'Uninstall failed');
      await refreshInstalled();
    },
    [refreshInstalled],
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      setError('');
      const res = await setPluginEnabled(id, enabled);
      if (!res.success) setError(res.error ?? 'Update failed');
      await refreshInstalled();
    },
    [refreshInstalled],
  );

  return (
    <div className={styles.wrap} aria-label="Plugin Manager">
      <div className={styles.top}>
        <div className={styles.tabs} role="tablist" aria-label="Plugin tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'installed'}
            className={`${styles.tab}${activeTab === 'installed' ? ` ${styles.tabActive}` : ''}`}
            onClick={() => setActiveTab('installed')}
          >
            Installed
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'marketplace'}
            className={`${styles.tab}${activeTab === 'marketplace' ? ` ${styles.tabActive}` : ''}`}
            onClick={() => setActiveTab('marketplace')}
          >
            Marketplace
          </button>
        </div>
        <button type="button" className={styles.btn} onClick={() => void refreshAll()}>
          Refresh
        </button>
      </div>

      <div className={styles.searchRow}>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by plugin name"
        />
      </div>

      {activeTab === 'installed' ? (
        <div className={styles.list} role="tabpanel" aria-label="Installed plugins">
          {installedFiltered.length === 0 && <div className={styles.pill}>No installed modules</div>}
          {installedFiltered.map((p) => (
            <div key={p.id} className={styles.card}>
              <div className={styles.row}>
                <div className={styles.meta}>
                  <div className={styles.name}>
                    {p.manifest.name} <span className={styles.pill}>v{p.version}</span>
                  </div>
                  <div className={styles.desc}>{p.manifest.description}</div>
                </div>
                <div className={styles.actions}>
                  <label className={styles.toggle}>
                    <input
                      className={styles.checkbox}
                      type="checkbox"
                      checked={p.enabled}
                      onChange={(e) => void handleToggle(p.id, e.target.checked)}
                    />
                    Enabled
                  </label>
                  <button type="button" className={styles.btn} onClick={() => void handleUninstall(p.id)}>
                    Uninstall
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.list} role="tabpanel" aria-label="Marketplace plugins">
          {registryFiltered.length === 0 && <div className={styles.pill}>Marketplace registry is empty</div>}
          {registryFiltered.map((entry) => {
            const id = entry.manifest.id;
            const inst = installedMap.get(id);
            return (
              <div key={id} className={styles.card}>
                <div className={styles.row}>
                  <div className={styles.meta}>
                    <div className={styles.name}>
                      {entry.manifest.name} <span className={styles.pill}>v{entry.manifest.version}</span>
                    </div>
                    <div className={styles.desc}>{entry.manifest.description}</div>
                  </div>
                  <div className={styles.actions}>
                    {inst ? (
                      <span className={styles.pill}>Installed</span>
                    ) : (
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={installingId === id}
                        onClick={() => void handleInstall(entry)}
                      >
                        {installingId === id ? 'Installing...' : 'Install'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}

