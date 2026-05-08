import { useEffect, useMemo, useState } from 'react';
import { VscBroadcast, VscChevronRight, VscDeviceMobile, VscGraph, VscInfo, VscScreenFull, VscSearch, VscSparkle } from 'react-icons/vsc';
import styles from './DashboardPage.module.css';
import { loadModuleUsage, scoreUsage } from '../../data/moduleUsage';
import type { Category, Module } from '../../types';

type FlatTool = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  module: Module;
};

type AppInfo = { version?: string; build?: string };
type NetworkInfo = { localIPs: string[]; publicIP: string; dnsStatus: string; internetStatus: string };
type NavigatorLike = Navigator & { vendor?: string; platform?: string };

function categoryColor(categoryId: string): string {
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

export default function DashboardPage({
  categories,
  onOpenTool,
  onCategorySelect,
}: {
  categories: Category[];
  onOpenTool: (categoryId: string, moduleId: string) => void;
  onCategorySelect: (categoryId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getAppInfo) return;
    void api.getAppInfo().then((v) => {
      const r = v as { version?: unknown; build?: unknown };
      setAppInfo({ version: typeof r?.version === 'string' ? r.version : undefined, build: typeof r?.build === 'string' ? r.build : undefined });
    });
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getNetworkInfo) return;

    const refresh = () => {
      void api.getNetworkInfo().then((v) => setNetworkInfo(v as NetworkInfo));
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const flatTools = useMemo<FlatTool[]>(() => {
    return categories.flatMap((c) =>
      c.modules.map((m) => ({
        categoryId: c.id,
        categoryName: c.name,
        categoryColor: categoryColor(c.id),
        module: m,
      })),
    );
  }, [categories]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return flatTools
      .filter((t) => {
        const name = String(t.module.name ?? '').toLowerCase();
        const desc = String(t.module.description ?? '').toLowerCase();
        return name.includes(q) || desc.includes(q);
      })
      .slice(0, 8);
  }, [flatTools, query]);

  const frequent = useMemo(() => {
    const usage = loadModuleUsage();
    const scored = usage
      .map((u) => ({ ...u, score: scoreUsage(u) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const picked = scored
      .map((u) => flatTools.find((t) => t.categoryId === u.categoryId && t.module.id === u.moduleId))
      .filter(Boolean) as FlatTool[];

    if (picked.length >= 4) return picked;
    const fill = flatTools.filter((t) => !picked.some((x) => x.module.id === t.module.id)).slice(0, 8 - picked.length);
    return [...picked, ...fill];
  }, [flatTools]);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <div className={styles.headerIcon}>
              <VscSparkle size={15} />
            </div>
            <span className={styles.headerKicker}>Dashboard</span>
          </div>
          <h1 className={styles.headerTitle}>Welcome back 👋</h1>
          <p className={styles.headerSub}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className={styles.searchWrap} data-focused={focused ? '1' : '0'}>
          <div className={styles.searchBox} data-focused={focused ? '1' : '0'}>
            <VscSearch className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              value={query}
              placeholder="Search tools…"
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            {query ? (
              <button className={styles.clearBtn} type="button" onClick={() => setQuery('')}>
                Clear
              </button>
            ) : (
              <kbd className={styles.kbd}>⌘ K</kbd>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className={`${styles.searchDropdown} fade-in`} role="listbox">
              <div className={styles.searchDropdownTitle}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </div>
              {searchResults.map((t) => (
                <button
                  key={t.module.id}
                  type="button"
                  className={styles.searchItem}
                  onClick={() => {
                    setQuery('');
                    onOpenTool(t.categoryId, t.module.id);
                  }}
                >
                  <div className={styles.searchItemIcon} style={{ color: t.categoryColor, background: `${t.categoryColor}18`, borderColor: `${t.categoryColor}30` }}>
                    {t.module.icon}
                  </div>
                  <div className={styles.searchItemText}>
                    <div className={styles.searchItemName}>{t.module.name}</div>
                    <div className={styles.searchItemDesc}>{t.module.description}</div>
                  </div>
                  <span className={styles.searchItemPill} style={{ color: t.categoryColor, background: `${t.categoryColor}15`, borderColor: `${t.categoryColor}25` }}>
                    {t.categoryName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`${styles.quickNav} no-scrollbar`}>
          {categories.map((c) => {
            const color = categoryColor(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={styles.quickNavItem}
                style={{ background: `${color}12`, borderColor: `${color}25`, color }}
                onClick={() => onCategorySelect(c.id)}
              >
                <span className={styles.quickNavIcon} style={{ color }}>
                  {c.icon}
                </span>
                <span className={styles.quickNavLabel}>{c.name}</span>
                <span className={styles.quickNavCount}>{c.modules.length}</span>
              </button>
            );
          })}
        </div>

        <Section title="Frequent Tools" icon={<VscGraph /> } action="View All Tools" onAction={() => onCategorySelect('all')}>
          <div className={styles.grid}>
            {frequent.slice(0, 8).map((t) => (
              <button
                key={t.module.id}
                type="button"
                className={styles.toolCard}
                onClick={() => onOpenTool(t.categoryId, t.module.id)}
              >
                <div className={styles.toolCardTop}>
                  <div className={styles.toolCardIcon} style={{ color: t.categoryColor, background: `${t.categoryColor}15`, borderColor: `${t.categoryColor}28` }}>
                    {t.module.icon}
                  </div>
                  <div className={styles.toolCardMeta}>
                    <div className={styles.toolCardName}>{t.module.name}</div>
                    <span className={styles.toolCardPill} style={{ color: t.categoryColor, background: `${t.categoryColor}15` }}>
                      {t.categoryName}
                    </span>
                  </div>
                </div>
                <div className={styles.toolCardDesc}>{t.module.description}</div>
              </button>
            ))}
          </div>
        </Section>

        <div className={styles.infoGrid}>
          <InfoCard
            title="Network"
            icon={<VscBroadcast />}
            iconColor="var(--accent-secondary)"
            items={[
              {
                label: 'Internet',
                value: networkInfo?.internetStatus ?? (navigator.onLine ? 'Connected' : 'Disconnected'),
                ok: (networkInfo?.internetStatus ?? (navigator.onLine ? 'Connected' : 'Disconnected')) === 'Connected',
              },
              { label: 'DNS', value: networkInfo?.dnsStatus ?? '-', ok: (networkInfo?.dnsStatus ?? '') === 'OK' },
              { label: 'Public IP', value: networkInfo?.publicIP ?? '-' },
              { label: 'Local IP', value: (networkInfo?.localIPs ?? ['-']).join('\n'), wrap: true, mono: true, pre: true },
            ]}
          />
          <InfoCard
            title="App Info"
            icon={<VscInfo />}
            iconColor="var(--accent-warning)"
            items={[
              { label: 'Version', value: appInfo?.version ?? '-' },
              { label: 'Build', value: appInfo?.build ?? '-' },
              { label: 'Local Time', value: now.toLocaleString() },
              { label: 'Unix Timestamp', value: String(Math.floor(now.getTime() / 1000)) },
              { label: 'Timezone', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
            ]}
          />
          <InfoCard
            title="Screen"
            icon={<VscScreenFull />}
            iconColor="var(--accent-success)"
            columns={2}
            items={[
              { label: 'Screen size', value: `${window.screen.width} × ${window.screen.height}` },
              { label: 'Orientation', value: String(window.screen.orientation?.type ?? '-') },
              { label: 'Orientation angle', value: `${Number(window.screen.orientation?.angle ?? 0)}°` },
              { label: 'Color depth', value: `${window.screen.colorDepth} bits` },
              { label: 'Pixel ratio', value: `${window.devicePixelRatio} dppx` },
              { label: 'Window size', value: `${window.innerWidth} × ${window.innerHeight}` },
            ]}
          />
          <InfoCard
            title="Device"
            icon={<VscDeviceMobile />}
            iconColor="var(--cat-security)"
            items={[
              { label: 'Browser vendor', value: String((navigator as NavigatorLike).vendor ?? '-') },
              { label: 'Languages', value: Array.isArray(navigator.languages) ? navigator.languages.join(', ') : String(navigator.language ?? '-') },
              { label: 'Platform', value: String((navigator as NavigatorLike).platform ?? 'Unknown') },
              { label: 'User agent', value: navigator.userAgent, wrap: true, mono: false },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  action,
  onAction,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          {icon}
          <h2>{title}</h2>
        </div>
        {action && (
          <button type="button" className={styles.sectionAction} onClick={onAction}>
            {action}
            <VscChevronRight />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function InfoCard({
  title,
  icon,
  iconColor,
  columns = 1,
  items,
}: {
  title: string;
  icon?: React.ReactNode;
  iconColor?: string;
  columns?: 1 | 2;
  items: Array<{ label: string; value: string; ok?: boolean; wrap?: boolean; pre?: boolean; mono?: boolean }>;
}) {
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoHeader}>
        {icon && (
          <span
            className={styles.infoHeaderIcon}
            style={{
              color: iconColor,
              background: `color-mix(in oklab, ${iconColor ?? 'var(--accent-secondary)'} 12%, transparent)`,
              borderColor: `color-mix(in oklab, ${iconColor ?? 'var(--accent-secondary)'} 28%, transparent)`,
            }}
          >
            {icon}
          </span>
        )}
        <h3>{title}</h3>
      </div>
      <div className={`${styles.infoBody}${columns === 2 ? ` ${styles.infoBodyGrid2}` : ''}`}>
        {items.map((item) => (
          <div key={`${title}-${item.label}`} className={`${styles.infoRow}${item.wrap ? ` ${styles.infoRowWrap}` : ''}`}>
            <span className={styles.infoLabel}>{item.label}</span>
            <span className={`${styles.infoValue}${item.wrap && item.mono === false ? ` ${styles.infoValueInherit}` : ''}`}>
              {typeof item.ok === 'boolean' && <span className={styles.dot} data-ok={item.ok ? '1' : '0'} />}
              <span className={`${styles.infoValueText}${item.pre ? ` ${styles.infoValuePre}` : ''}`}>{item.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
