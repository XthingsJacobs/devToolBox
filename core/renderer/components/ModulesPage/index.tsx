import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './ModulesPage.module.css';
import type { InstalledMarketplacePlugin, MarketplaceRegistry, MarketplaceRegistryEntry } from '../../marketplace/types';
import {
  DEFAULT_MARKETPLACE_REGISTRY_URL,
  fetchMarketplaceRegistry,
  getBundledRegistry,
  loadMarketplaceRegistryUrl,
} from '../../marketplace/registry';
import { installPlugin, listInstalledPlugins, setPluginEnabled, uninstallPlugin } from '../../marketplace/api';
import { compareVersions, isNewerVersion } from '../../marketplace/version';
import { VscArrowUp, VscCheck, VscChevronDown, VscExtensions, VscRefresh, VscSearch, VscTrash } from 'react-icons/vsc';

type TabId = 'installed' | 'marketplace';

function categoryColor(categoryId: string) {
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

export default function ModulesPage({ onUpdated }: { onUpdated?: (installed: InstalledMarketplacePlugin[]) => void }) {
  const bundledRegistry = useMemo(() => getBundledRegistry(), []);
  const [activeTab, setActiveTab] = useState<TabId>('installed');
  const [query, setQuery] = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [registry, setRegistry] = useState<MarketplaceRegistry>(bundledRegistry);
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [onUpdated]);

  const refreshRegistry = useCallback(
    async (options?: { force?: boolean }) => {
      const url = loadMarketplaceRegistryUrl() || DEFAULT_MARKETPLACE_REGISTRY_URL;
      try {
        const remote = await fetchMarketplaceRegistry(url, options);
        setRegistry(remote);
      } catch (e: unknown) {
        setRegistry(bundledRegistry);
        setError(e instanceof Error ? e.message : String(e));
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

  const registryLatestMap = useMemo(() => {
    const m = new Map<string, MarketplaceRegistryEntry>();
    for (const e of registry.plugins) {
      const id = e.manifest?.id;
      if (!id) continue;
      const cur = m.get(id);
      if (!cur) {
        m.set(id, e);
        continue;
      }
      const nextV = String(e.manifest?.version ?? '');
      const curV = String(cur.manifest?.version ?? '');
      if (compareVersions(nextV, curV) > 0) m.set(id, e);
    }
    return m;
  }, [registry.plugins]);

  const marketplaceLatest = useMemo(() => Array.from(registryLatestMap.values()), [registryLatestMap]);
  const installedMap = useMemo(() => new Map(installed.map((p) => [p.id, p])), [installed]);

  const cats = useMemo(() => {
    const list = activeTab === 'installed' ? installed : marketplaceLatest.map((e) => ({ manifest: e.manifest } as InstalledMarketplacePlugin));
    const uniq = Array.from(new Set(list.map((x) => x.manifest.categoryId).filter(Boolean))).sort();
    return ['All', ...uniq];
  }, [activeTab, installed, marketplaceLatest]);

  const q = query.trim().toLowerCase();

  const upgradeEntries = useMemo(() => {
    const res: Array<{ inst: InstalledMarketplacePlugin; latest: MarketplaceRegistryEntry }> = [];
    for (const p of installed) {
      const latest = registryLatestMap.get(p.id);
      if (!latest) continue;
      if (isNewerVersion(String(latest.manifest.version ?? ''), String(p.version ?? ''))) res.push({ inst: p, latest });
    }
    return res;
  }, [installed, registryLatestMap]);

  const filteredInstalled = useMemo(() => {
    return installed.filter((p) => {
      const matchQ = !q || p.manifest.name.toLowerCase().includes(q) || p.manifest.description.toLowerCase().includes(q);
      const matchC = filterCat === 'All' || p.manifest.categoryId === filterCat;
      return matchQ && matchC;
    });
  }, [filterCat, installed, q]);

  const filteredMarketplace = useMemo(() => {
    return marketplaceLatest.filter((e) => {
      const matchQ = !q || e.manifest.name.toLowerCase().includes(q) || e.manifest.description.toLowerCase().includes(q);
      const matchC = filterCat === 'All' || e.manifest.categoryId === filterCat;
      return matchQ && matchC;
    });
  }, [filterCat, marketplaceLatest, q]);

  const handleInstall = useCallback(
    async (entry: MarketplaceRegistryEntry) => {
      setError('');
      setInstallingId(entry.manifest.id);
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

  const handleUpgradeAll = useCallback(async () => {
    for (const { latest } of upgradeEntries) {
      await handleInstall(latest);
    }
  }, [handleInstall, upgradeEntries]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <VscExtensions size={16} />
          </div>
          <div>
            <div className={styles.headerTitle}>Module Center</div>
            <div className={styles.headerSub}>
              <span className={styles.headerSubStrong}>{installed.length} installed</span>
              <span className={styles.dotSep}>·</span>
              {marketplaceLatest.length} available
              {upgradeEntries.length > 0 && (
                <>
                  <span className={styles.dotSep}>·</span>
                  <span className={styles.headerWarn}>{upgradeEntries.length} update{upgradeEntries.length > 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={() => void refreshAll({ force: true })} aria-label="Refresh">
          <VscRefresh className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className={styles.topbar}>
        <div className={styles.tabs} role="tablist" aria-label="Module tabs">
          {(['installed', 'marketplace'] as const).map((tab) => {
            const active = activeTab === tab;
            const count = tab === 'installed' ? installed.length : marketplaceLatest.length;
            return (
              <button
                key={tab}
                type="button"
                className={styles.tab}
                data-active={active ? '1' : '0'}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'installed' ? 'Installed' : 'Marketplace'}
                <span className={styles.tabCount} data-active={active ? '1' : '0'}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.spacer} />

        <div className={styles.filters}>
          <div className={styles.selectWrap}>
            <select className={styles.select} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <VscChevronDown className={styles.selectIcon} />
          </div>

          <div className={styles.search}>
            <VscSearch className={styles.searchIcon} />
            <input className={styles.searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search modules…" />
          </div>
        </div>
      </div>

      <div className={styles.list}>
        {activeTab === 'installed' && upgradeEntries.length > 0 && (
          <div className={styles.upgradeBanner}>
            <div className={styles.upgradeLeft}>
              <VscArrowUp className={styles.upgradeIcon} />
              <div className={styles.upgradeText}>
                <span className={styles.upgradeTitle}>
                  {upgradeEntries.length} update{upgradeEntries.length > 1 ? 's' : ''} available
                </span>
                <span className={styles.upgradeSub}>Keep your modules up to date for the latest fixes.</span>
              </div>
            </div>
            <button type="button" className={styles.upgradeBtn} onClick={() => void handleUpgradeAll()}>
              Update All
            </button>
          </div>
        )}

        {activeTab === 'installed' ? (
          <div className={styles.cards}>
            {filteredInstalled.map((p) => {
              const latest = registryLatestMap.get(p.id);
              const hasUpdate = latest ? isNewerVersion(String(latest.manifest.version ?? ''), String(p.version ?? '')) : false;
              const color = categoryColor(p.manifest.categoryId);
              return (
                <div key={p.id} className={styles.card}>
                  <div className={styles.cardIcon} style={{ color, background: `${color}12`, borderColor: `${color}22` }}>
                    <VscExtensions />
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardName}>{p.manifest.name}</div>
                      <span className={styles.pill}>v{p.version}</span>
                      {hasUpdate && latest && <span className={`${styles.pill} ${styles.pillUpgrade}`}>v{latest.manifest.version}</span>}
                      <span className={styles.pillCat} style={{ color, background: `${color}12` }}>
                        {p.manifest.categoryId}
                      </span>
                      {!p.enabled && <span className={styles.pillMuted}>Disabled</span>}
                    </div>
                    <div className={styles.cardDesc}>{p.manifest.description}</div>
                    <div className={styles.cardMeta}>by {p.manifest.author}</div>
                  </div>

                  <div className={styles.actions}>
                    {hasUpdate && latest && (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        data-variant="upgrade"
                        disabled={installingId === p.id}
                        onClick={() => void handleInstall(latest)}
                      >
                        <VscArrowUp />
                        Upgrade
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.actionBtn}
                      data-variant={p.enabled ? 'enabled' : 'disabled'}
                      onClick={() => void handleToggle(p.id, !p.enabled)}
                    >
                      <span className={styles.togglePill} data-enabled={p.enabled ? '1' : '0'}>
                        <span className={styles.toggleDot} data-enabled={p.enabled ? '1' : '0'} />
                      </span>
                      {p.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button type="button" className={styles.iconBtn} onClick={() => void handleUninstall(p.id)} aria-label="Uninstall">
                      <VscTrash />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredInstalled.length === 0 && <div className={styles.empty}>No installed modules</div>}
          </div>
        ) : (
          <div className={styles.cards}>
            {filteredMarketplace.map((entry) => {
              const id = entry.manifest.id;
              const inst = installedMap.get(id);
              const hasUpdate = inst ? isNewerVersion(String(entry.manifest.version ?? ''), String(inst.version ?? '')) : false;
              const color = categoryColor(entry.manifest.categoryId);
              return (
                <div key={id} className={styles.card}>
                  <div className={styles.cardIcon} style={{ color, background: `${color}12`, borderColor: `${color}22` }}>
                    <VscExtensions />
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardName}>{entry.manifest.name}</div>
                      <span className={styles.pill}>v{entry.manifest.version}</span>
                      <span className={styles.pillCat} style={{ color, background: `${color}12` }}>
                        {entry.manifest.categoryId}
                      </span>
                      {inst && <span className={styles.pillOk}><VscCheck /> Installed</span>}
                    </div>
                    <div className={styles.cardDesc}>{entry.manifest.description}</div>
                    <div className={styles.cardMeta}>by {entry.manifest.author}</div>
                  </div>

                  <div className={styles.actions}>
                    {inst ? (
                      hasUpdate ? (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          data-variant="primary"
                          disabled={installingId === id}
                          onClick={() => void handleInstall(entry)}
                        >
                          <VscArrowUp />
                          Upgrade
                        </button>
                      ) : (
                        <span className={styles.pillOk}>
                          <VscCheck /> Installed
                        </span>
                      )
                    ) : (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        data-variant="primary"
                        disabled={installingId === id}
                        onClick={() => void handleInstall(entry)}
                      >
                        Install
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredMarketplace.length === 0 && <div className={styles.empty}>Marketplace registry is empty</div>}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  );
}

