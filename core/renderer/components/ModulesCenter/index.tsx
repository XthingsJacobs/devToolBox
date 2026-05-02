import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './ModulesCenter.module.css';
import {
  DEFAULT_MARKETPLACE_REGISTRY_URL,
  fetchMarketplaceRegistry,
  getBundledRegistry,
  loadMarketplaceRegistryUrl,
} from '../../marketplace/registry';
import { installPlugin, listInstalledPlugins, setPluginEnabled, uninstallPlugin } from '../../marketplace/api';
import type { InstalledMarketplacePlugin, MarketplaceRegistry, MarketplaceRegistryEntry } from '../../marketplace/types';

interface ModulesCenterProps {
  onUpdated?: (installed: InstalledMarketplacePlugin[]) => void;
}

export default function ModulesCenter({ onUpdated }: ModulesCenterProps) {
  const bundledRegistry = useMemo(() => getBundledRegistry(), []);
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

  const refreshRegistry = useCallback(
    async (options?: { force?: boolean }) => {
    const url = loadMarketplaceRegistryUrl() || DEFAULT_MARKETPLACE_REGISTRY_URL;
    try {
      if (import.meta.env.DEV) console.info('[marketplace] registry:fetch:start', url);
        const remote = await fetchMarketplaceRegistry(url, options);
      if (import.meta.env.DEV) console.info('[marketplace] registry:fetch:ok', { plugins: remote.plugins?.length ?? 0 });
      setRegistry(remote);
    } catch (e: unknown) {
      if (import.meta.env.DEV) console.error('[marketplace] registry:fetch:error', e);
      setRegistry(bundledRegistry);
      setError(e instanceof Error ? e.message : String(e));
    }
    },
    [bundledRegistry],
  );

  const refreshAll = useCallback(
    async (options?: { force?: boolean }) => {
    await refreshInstalled();
      await refreshRegistry(options);
    },
    [refreshInstalled, refreshRegistry],
  );

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const handler = () => void refreshRegistry({ force: true });
    window.addEventListener('devtoolbox:registryUrlChanged', handler);
    return () => window.removeEventListener('devtoolbox:registryUrlChanged', handler);
  }, [refreshRegistry]);

  const installedMap = useMemo(() => new Map(installed.map((p) => [p.id, p])), [installed]);

  const handleInstall = useCallback(
    async (entry: MarketplaceRegistryEntry) => {
      setError('');
      const id = entry.manifest.id;
      setInstallingId(id);
      try {
        if (import.meta.env.DEV) console.info('[marketplace] install:start', entry);
        const res = await installPlugin(entry);
        if (import.meta.env.DEV) console.info('[marketplace] install:result', res);
        if (!res.success) setError(res.error ?? 'Install failed');
      } catch (e: unknown) {
        if (import.meta.env.DEV) console.error('[marketplace] install:error', e);
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
    <main className={styles.wrap} aria-label="Modules Center">
      <div className={styles.header}>
        <div className={styles.title}>Modules</div>
        <button type="button" className={styles.btn} onClick={() => void refreshAll({ force: true })}>
          Refresh
        </button>
      </div>

      <div className={styles.sectionTitle}>Installed</div>
      <div className={styles.list}>
        {installed.length === 0 && <div className={styles.pill}>No installed modules</div>}
        {installed.map((p) => (
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

      <div className={styles.sectionTitle}>Marketplace</div>
      <div className={styles.list}>
        {registry.plugins.length === 0 && <div className={styles.pill}>Marketplace registry is empty</div>}
        {registry.plugins.map((entry) => {
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

      {error && <div className={styles.error}>{error}</div>}
    </main>
  );
}
