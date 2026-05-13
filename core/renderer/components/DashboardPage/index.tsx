import { useCallback, useEffect, useMemo, useRef, useState, type LegacyRef } from 'react';
import { VscBroadcast, VscChevronRight, VscDeviceMobile, VscGraph, VscInfo, VscScreenFull, VscSearch, VscSparkle } from 'react-icons/vsc';
import ReactGridLayout, { type Layout, type LayoutItem, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
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

type WidgetId = 'frequent' | 'network' | 'appInfo' | 'screen' | 'device';
type WidgetLayout = { order: WidgetId[]; spanById: Record<WidgetId, number>; rowSpanById: Record<WidgetId, number> };

const WIDGET_STORAGE_KEY_V2 = 'devtoolbox.dashboard.widgets.v2';
const WIDGET_STORAGE_KEY = 'devtoolbox.dashboard.widgets.v3';
const GRID_COLS = 24;
const GRID_AUTO_ROW_PX = 8;
const GRID_GAP_PX = 16;

const DEFAULT_WIDGET_ROW_SPAN: Record<WidgetId, number> = {
  frequent: 18,
  network: 12,
  appInfo: 12,
  screen: 10,
  device: 11,
};

function isWidgetId(v: unknown): v is WidgetId {
  return v === 'frequent' || v === 'network' || v === 'appInfo' || v === 'screen' || v === 'device';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function clampSpan(v: number): number {
  if (!Number.isFinite(v)) return 12;
  const n = Math.round(v);
  return Math.max(1, Math.min(GRID_COLS, n));
}

function clampRowSpan(v: number): number {
  if (!Number.isFinite(v)) return 10;
  const n = Math.round(v);
  return Math.max(4, Math.min(200, n));
}

function loadWidgetLayout(): WidgetLayout {
  const fallback: WidgetLayout = {
    order: ['frequent', 'network', 'appInfo', 'screen', 'device'],
    spanById: {
      frequent: 24,
      network: 12,
      appInfo: 12,
      screen: 12,
      device: 12,
    },
    rowSpanById: { ...DEFAULT_WIDGET_ROW_SPAN },
  };
  const raw = localStorage.getItem(WIDGET_STORAGE_KEY) ?? localStorage.getItem(WIDGET_STORAGE_KEY_V2);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return fallback;
    const orderRaw = parsed.order;
    const spanRaw = parsed.spanById;
    const rowSpanRaw = parsed.rowSpanById;
    if (!Array.isArray(orderRaw) || !isRecord(spanRaw)) return fallback;
    const order = orderRaw.filter(isWidgetId);
    const uniq = Array.from(new Set(order));
    const allIds: WidgetId[] = ['frequent', 'network', 'appInfo', 'screen', 'device'];
    const fullOrder = [...uniq, ...allIds.filter((id) => !uniq.includes(id))];
    const spanById = { ...fallback.spanById };
    const rowSpanById = { ...fallback.rowSpanById };
    for (const id of allIds) {
      const v = spanRaw[id];
      if (typeof v === 'number') spanById[id] = clampSpan(v);
      const h = isRecord(rowSpanRaw) ? rowSpanRaw[id] : undefined;
      if (typeof h === 'number') rowSpanById[id] = clampRowSpan(h);
    }
    return { order: fullOrder, spanById, rowSpanById };
  } catch {
    return fallback;
  }
}

function saveWidgetLayout(layout: WidgetLayout) {
  localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(layout));
}

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
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [layout, setLayout] = useState<WidgetLayout>(() => loadWidgetLayout());
  const [gridLayout, setGridLayout] = useState<LayoutItem[]>([]);
  const [isGridInteracting, setIsGridInteracting] = useState(false);
  const layoutRef = useRef(layout);
  const { width: gridWidth, containerRef: gridContainerRef, mounted: gridMounted } = useContainerWidth();

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

  useEffect(() => {
    if (searchResults.length === 0) {
      setActiveSearchIndex(0);
      return;
    }
    setActiveSearchIndex((i) => Math.max(0, Math.min(searchResults.length - 1, i)));
  }, [searchResults.length]);

  useEffect(() => {
    const cur = searchResults[activeSearchIndex];
    if (!cur) return;
    searchItemRefs.current[cur.module.id]?.scrollIntoView({ block: 'nearest' });
  }, [activeSearchIndex, searchResults]);

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

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    saveWidgetLayout(layout);
  }, [layout]);

  const toMutableLayout = useCallback((l: Layout) => l.map((x) => ({ ...x })), []);

  const buildGridLayout = useCallback((source: WidgetLayout) => {
    const next: LayoutItem[] = [];
    let x = 0;
    let y = 0;
    let rowMaxH = 0;
    for (const id of source.order) {
      const w = clampSpan(source.spanById[id] ?? 12);
      const h = clampRowSpan(source.rowSpanById[id] ?? DEFAULT_WIDGET_ROW_SPAN[id] ?? 10);
      if (x + w > GRID_COLS) {
        y += rowMaxH || 1;
        x = 0;
        rowMaxH = 0;
      }
      next.push({
        i: id,
        x,
        y,
        w,
        h,
        minW: 6,
        maxW: GRID_COLS,
        minH: 6,
        maxH: 200,
      });
      x += w;
      rowMaxH = Math.max(rowMaxH, h);
    }
    return toMutableLayout(verticalCompactor.compact(next, GRID_COLS));
  }, [toMutableLayout]);

  useEffect(() => {
    if (isGridInteracting) return;
    setGridLayout(buildGridLayout(layout));
  }, [buildGridLayout, isGridInteracting, layout]);

  const commitLayout = useCallback((nextLayout: Layout) => {
    const compacted = verticalCompactor.compact(nextLayout, GRID_COLS);
    const order = [...compacted]
      .sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      })
      .map((l) => l.i)
      .filter(isWidgetId);
    const spanById = { ...layoutRef.current.spanById };
    const rowSpanById = { ...layoutRef.current.rowSpanById };
    for (const l of compacted) {
      if (!isWidgetId(l.i)) continue;
      spanById[l.i] = clampSpan(l.w);
      rowSpanById[l.i] = clampRowSpan(l.h);
    }
    setLayout({ order, spanById, rowSpanById });
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerMeta}>
              <div className={styles.headerIcon}>
                <VscSparkle size={15} />
              </div>
              <span className={styles.headerKicker}>Dashboard</span>
            </div>

            <div className={styles.searchWrap} data-focused={focused ? '1' : '0'}>
              <div className={styles.searchBox} data-focused={focused ? '1' : '0'}>
                <VscSearch className={styles.searchIcon} />
                <input
                  ref={searchInputRef}
                  className={styles.searchInput}
                  value={query}
                  placeholder="Search tools…"
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveSearchIndex(0);
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  onKeyDown={(e) => {
                    if (searchResults.length === 0) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActiveSearchIndex((i) => (i + 1) % searchResults.length);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActiveSearchIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
                      return;
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const cur = searchResults[activeSearchIndex];
                      if (!cur) return;
                      setQuery('');
                      setFocused(false);
                      searchInputRef.current?.blur();
                      onOpenTool(cur.categoryId, cur.module.id);
                      return;
                    }
                    if (e.key === 'Escape') {
                      if (!query) return;
                      e.preventDefault();
                      setQuery('');
                      setActiveSearchIndex(0);
                    }
                  }}
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
                <div
                  className={`${styles.searchDropdown} fade-in`}
                  role="listbox"
                  aria-activedescendant={`dash-search-${searchResults[activeSearchIndex]?.module.id ?? ''}`}
                >
                  <div className={styles.searchDropdownTitle}>
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                  </div>
                  {searchResults.map((t, idx) => (
                    <button
                      key={t.module.id}
                      type="button"
                      id={`dash-search-${t.module.id}`}
                      role="option"
                      aria-selected={idx === activeSearchIndex}
                      className={`${styles.searchItem}${idx === activeSearchIndex ? ` ${styles.searchItemActive}` : ''}`}
                      ref={(el) => {
                        searchItemRefs.current[t.module.id] = el;
                      }}
                      onClick={() => {
                        setQuery('');
                        onOpenTool(t.categoryId, t.module.id);
                      }}
                      onMouseEnter={() => setActiveSearchIndex(idx)}
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
          </div>

          <h1 className={styles.headerTitle}>Welcome back 👋</h1>
          <p className={styles.headerSub}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
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

        <div ref={gridContainerRef as unknown as LegacyRef<HTMLDivElement>} className={styles.widgetGrid}>
          {gridMounted ? (
            <ReactGridLayout
              width={gridWidth}
              layout={gridLayout}
              compactor={verticalCompactor}
              gridConfig={{
                cols: GRID_COLS,
                rowHeight: GRID_AUTO_ROW_PX,
                margin: [GRID_GAP_PX, GRID_GAP_PX],
                containerPadding: [0, 0],
                maxRows: Number.POSITIVE_INFINITY,
              }}
              dragConfig={{ enabled: true, bounded: true, handle: `.${styles.widgetHeader}`, cancel: '.react-resizable-handle', threshold: 3 }}
              resizeConfig={{
                enabled: true,
                handles: ['e', 's', 'se'],
                handleComponent: (axis, ref) => (
                  <span
                    ref={ref}
                    className={`react-resizable-handle react-resizable-handle-${axis} ${styles.rglResizeHandle} ${styles[`rglResizeHandle_${axis}`]}`}
                  />
                ),
              }}
              onDragStart={() => setIsGridInteracting(true)}
              onResizeStart={() => setIsGridInteracting(true)}
              onLayoutChange={(next) => setGridLayout(toMutableLayout(next))}
              onDragStop={(next) => {
                setIsGridInteracting(false);
                commitLayout(next);
              }}
              onResizeStop={(next) => {
                setIsGridInteracting(false);
                commitLayout(next);
              }}
            >
          <div key="frequent">
            <Widget
              title="Frequent Tools"
              icon={<VscGraph />}
              accentColor="var(--accent-secondary)"
              action={
                <button type="button" className={styles.widgetAction} draggable={false} onClick={() => onCategorySelect('all')}>
                  View All Tools
                  <VscChevronRight />
                </button>
              }
            >
              <div className={styles.grid}>
                {frequent.slice(0, 8).map((t) => (
                  <button key={t.module.id} type="button" className={styles.toolCard} onClick={() => onOpenTool(t.categoryId, t.module.id)}>
                    <div className={styles.toolCardTop}>
                      <div
                        className={styles.toolCardIcon}
                        style={{ color: t.categoryColor, background: `${t.categoryColor}15`, borderColor: `${t.categoryColor}28` }}
                      >
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
            </Widget>
          </div>

          <div key="network">
            <Widget title="Network" icon={<VscBroadcast />} accentColor="var(--accent-secondary)">
              <InfoBody
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
            </Widget>
          </div>

          <div key="appInfo">
            <Widget title="App Info" icon={<VscInfo />} accentColor="var(--accent-warning)">
              <InfoBody
                items={[
                  { label: 'Version', value: appInfo?.version ?? '-' },
                  { label: 'Build', value: appInfo?.build ?? '-' },
                  { label: 'Local Time', value: now.toLocaleString() },
                  { label: 'Unix Timestamp', value: String(Math.floor(now.getTime() / 1000)) },
                  { label: 'Timezone', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
                ]}
              />
            </Widget>
          </div>

          <div key="screen">
            <Widget title="Screen" icon={<VscScreenFull />} accentColor="var(--accent-success)">
              <InfoBody
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
            </Widget>
          </div>

          <div key="device">
            <Widget title="Device" icon={<VscDeviceMobile />} accentColor="var(--cat-security)">
              <InfoBody
                items={[
                  { label: 'Browser vendor', value: String((navigator as NavigatorLike).vendor ?? '-') },
                  {
                    label: 'Languages',
                    value: Array.isArray(navigator.languages) ? navigator.languages.join(', ') : String(navigator.language ?? '-'),
                  },
                  { label: 'Platform', value: String((navigator as NavigatorLike).platform ?? 'Unknown') },
                  { label: 'User agent', value: navigator.userAgent, wrap: true, mono: false },
                ]}
              />
            </Widget>
          </div>
            </ReactGridLayout>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Widget({
  title,
  icon,
  accentColor,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  accentColor?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.widget}>
      <div className={styles.widgetHeader} style={{ borderLeftColor: accentColor }}>
        <div className={styles.widgetHeaderLeft}>
          {icon ? (
            <span className={styles.widgetIcon} style={{ color: accentColor }}>
              {icon}
            </span>
          ) : null}
          <span className={styles.widgetTitle}>{title}</span>
        </div>
        <div className={styles.widgetHeaderRight} onMouseDown={(e) => e.stopPropagation()}>
          {action}
        </div>
      </div>
      <div className={styles.widgetBody}>{children}</div>
    </div>
  );
}

function InfoBody({
  columns = 1,
  items,
}: {
  columns?: 1 | 2;
  items: Array<{ label: string; value: string; ok?: boolean; wrap?: boolean; pre?: boolean; mono?: boolean }>;
}) {
  return (
    <div className={`${styles.infoBody}${columns === 2 ? ` ${styles.infoBodyGrid2}` : ''}`}>
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className={`${styles.infoRow}${item.wrap ? ` ${styles.infoRowWrap}` : ''}`}>
          <span className={styles.infoLabel}>{item.label}</span>
          <span className={`${styles.infoValue}${item.wrap && item.mono === false ? ` ${styles.infoValueInherit}` : ''}`}>
            {typeof item.ok === 'boolean' && <span className={styles.dot} data-ok={item.ok ? '1' : '0'} />}
            <span className={`${styles.infoValueText}${item.pre ? ` ${styles.infoValuePre}` : ''}`}>{item.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
