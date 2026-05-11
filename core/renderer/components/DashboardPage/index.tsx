import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type WidgetId = 'frequent' | 'network' | 'appInfo' | 'screen' | 'device';
type WidgetLayout = { order: WidgetId[]; spanById: Record<WidgetId, number> };

const WIDGET_STORAGE_KEY = 'devtoolbox.dashboard.widgets.v2';
const GRID_COLS = 24;
const GRID_AUTO_ROW_PX = 8;

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
  };
  const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return fallback;
    const orderRaw = parsed.order;
    const spanRaw = parsed.spanById;
    if (!Array.isArray(orderRaw) || !isRecord(spanRaw)) return fallback;
    const order = orderRaw.filter(isWidgetId);
    const uniq = Array.from(new Set(order));
    const allIds: WidgetId[] = ['frequent', 'network', 'appInfo', 'screen', 'device'];
    const fullOrder = [...uniq, ...allIds.filter((id) => !uniq.includes(id))];
    const spanById = { ...fallback.spanById };
    for (const id of allIds) {
      const v = spanRaw[id];
      if (typeof v === 'number') spanById[id] = clampSpan(v);
    }
    return { order: fullOrder, spanById };
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
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
  const [overId, setOverId] = useState<WidgetId | null>(null);
  const [resizingId, setResizingId] = useState<WidgetId | null>(null);
  const [rowSpanById, setRowSpanById] = useState<Record<string, number>>({});
  const widgetGridRef = useRef<HTMLDivElement | null>(null);
  const widgetRefs = useRef<Record<WidgetId, HTMLDivElement | null>>({
    frequent: null,
    network: null,
    appInfo: null,
    screen: null,
    device: null,
  });
  const layoutRef = useRef(layout);
  const isResizingRef = useRef(false);
  const recalcRafRef = useRef<number | null>(null);

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
    if (isResizingRef.current) return;
    saveWidgetLayout(layout);
  }, [layout]);

  const moveWidget = useCallback((dragId: WidgetId, overId: WidgetId) => {
    if (dragId === overId) return;
    setLayout((prev) => {
      const next = prev.order.filter((x) => x !== dragId);
      const idx = next.indexOf(overId);
      if (idx < 0) return prev;
      next.splice(idx, 0, dragId);
      return { ...prev, order: next };
    });
  }, []);

  const setSpan = useCallback((id: WidgetId, span: number) => {
    setLayout((prev) => {
      const nextSpan = clampSpan(span);
      if (prev.spanById[id] === nextSpan) return prev;
      return { ...prev, spanById: { ...prev.spanById, [id]: nextSpan } };
    });
  }, []);

  const handleWidgetDragStart = useCallback((id: WidgetId) => {
    setDraggingId(id);
    setOverId(null);
  }, []);

  const handleWidgetDragEnd = useCallback(() => {
    setDraggingId(null);
    setOverId(null);
  }, []);

  const handleResizeStart = useCallback((id: WidgetId) => {
    isResizingRef.current = true;
    setResizingId(id);
  }, []);

  const handleResizeEnd = useCallback(() => {
    isResizingRef.current = false;
    setResizingId(null);
    saveWidgetLayout(layoutRef.current);
  }, []);

  const recalcMasonry = useCallback(() => {
    const grid = widgetGridRef.current;
    if (!grid) return;
    const style = window.getComputedStyle(grid);
    const rowGap = Number.parseFloat(style.rowGap || '0') || 0;
    const rowUnit = GRID_AUTO_ROW_PX + rowGap;
    const next: Record<string, number> = {};
    layout.order.forEach((id) => {
      const el = widgetRefs.current[id];
      if (!el) return;
      const h = el.getBoundingClientRect().height;
      const span = Math.max(1, Math.ceil((h + rowGap) / rowUnit));
      next[id] = span;
    });
    setRowSpanById(next);
  }, [layout.order]);

  const scheduleRecalcMasonry = useCallback(() => {
    if (recalcRafRef.current !== null) return;
    recalcRafRef.current = window.requestAnimationFrame(() => {
      recalcRafRef.current = null;
      recalcMasonry();
    });
  }, [recalcMasonry]);

  useEffect(() => {
    const grid = widgetGridRef.current;
    if (!grid) return;
    scheduleRecalcMasonry();

    const ro = new ResizeObserver(() => {
      scheduleRecalcMasonry();
    });
    ro.observe(grid);
    layout.order.forEach((id) => {
      const el = widgetRefs.current[id];
      if (el) ro.observe(el);
    });

    return () => {
      if (recalcRafRef.current !== null) {
        window.cancelAnimationFrame(recalcRafRef.current);
        recalcRafRef.current = null;
      }
      ro.disconnect();
    };
  }, [layout.order, layout.spanById, scheduleRecalcMasonry]);

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

        <div ref={widgetGridRef} className={styles.widgetGrid}>
          {layout.order.map((id) => {
            const span = layout.spanById[id];
            const rowSpan = rowSpanById[id] ?? 1;
            if (id === 'frequent') {
              return (
                <Widget
                  key={id}
                  id={id}
                  span={span}
                  rowSpan={rowSpan}
                  gridRef={widgetGridRef}
                  onRef={(wid, el) => {
                    widgetRefs.current[wid] = el;
                  }}
                  title="Frequent Tools"
                  icon={<VscGraph />}
                  accentColor="var(--accent-secondary)"
                  draggingId={draggingId}
                  overId={overId}
                  resizingId={resizingId}
                  onOver={setOverId}
                  onDragStart={handleWidgetDragStart}
                  onDragEnd={handleWidgetDragEnd}
                  onDrop={moveWidget}
                  onResize={setSpan}
                  onResizeStart={handleResizeStart}
                  onResizeEnd={handleResizeEnd}
                  action={
                    <button type="button" className={styles.widgetAction} draggable={false} onClick={() => onCategorySelect('all')}>
                      View All Tools
                      <VscChevronRight />
                    </button>
                  }
                >
                  <div className={styles.grid}>
                    {frequent.slice(0, 8).map((t) => (
                      <button
                        key={t.module.id}
                        type="button"
                        className={styles.toolCard}
                        onClick={() => onOpenTool(t.categoryId, t.module.id)}
                      >
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
              );
            }

            if (id === 'network') {
              return (
                <Widget
                  key={id}
                  id={id}
                  span={span}
                  rowSpan={rowSpan}
                  gridRef={widgetGridRef}
                  onRef={(wid, el) => {
                    widgetRefs.current[wid] = el;
                  }}
                  title="Network"
                  icon={<VscBroadcast />}
                  accentColor="var(--accent-secondary)"
                  draggingId={draggingId}
                  overId={overId}
                  resizingId={resizingId}
                  onOver={setOverId}
                  onDragStart={handleWidgetDragStart}
                  onDragEnd={handleWidgetDragEnd}
                  onDrop={moveWidget}
                  onResize={setSpan}
                  onResizeStart={handleResizeStart}
                  onResizeEnd={handleResizeEnd}
                >
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
              );
            }

            if (id === 'appInfo') {
              return (
                <Widget
                  key={id}
                  id={id}
                  span={span}
                  rowSpan={rowSpan}
                  gridRef={widgetGridRef}
                  onRef={(wid, el) => {
                    widgetRefs.current[wid] = el;
                  }}
                  title="App Info"
                  icon={<VscInfo />}
                  accentColor="var(--accent-warning)"
                  draggingId={draggingId}
                  overId={overId}
                  resizingId={resizingId}
                  onOver={setOverId}
                  onDragStart={handleWidgetDragStart}
                  onDragEnd={handleWidgetDragEnd}
                  onDrop={moveWidget}
                  onResize={setSpan}
                  onResizeStart={handleResizeStart}
                  onResizeEnd={handleResizeEnd}
                >
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
              );
            }

            if (id === 'screen') {
              return (
                <Widget
                  key={id}
                  id={id}
                  span={span}
                  rowSpan={rowSpan}
                  gridRef={widgetGridRef}
                  onRef={(wid, el) => {
                    widgetRefs.current[wid] = el;
                  }}
                  title="Screen"
                  icon={<VscScreenFull />}
                  accentColor="var(--accent-success)"
                  draggingId={draggingId}
                  overId={overId}
                  resizingId={resizingId}
                  onOver={setOverId}
                  onDragStart={handleWidgetDragStart}
                  onDragEnd={handleWidgetDragEnd}
                  onDrop={moveWidget}
                  onResize={setSpan}
                  onResizeStart={handleResizeStart}
                  onResizeEnd={handleResizeEnd}
                >
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
              );
            }

            return (
              <Widget
                key={id}
                id={id}
                span={span}
                rowSpan={rowSpan}
                gridRef={widgetGridRef}
                onRef={(wid, el) => {
                  widgetRefs.current[wid] = el;
                }}
                title="Device"
                icon={<VscDeviceMobile />}
                accentColor="var(--cat-security)"
                draggingId={draggingId}
                overId={overId}
                resizingId={resizingId}
                onOver={setOverId}
                onDragStart={handleWidgetDragStart}
                onDragEnd={handleWidgetDragEnd}
                onDrop={moveWidget}
                onResize={setSpan}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
              >
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
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Widget({
  id,
  span,
  rowSpan,
  gridRef,
  onRef,
  title,
  icon,
  accentColor,
  action,
  draggingId,
  overId,
  resizingId,
  onOver,
  onDragStart,
  onDragEnd,
  onDrop,
  onResize,
  onResizeStart,
  onResizeEnd,
  children,
}: {
  id: WidgetId;
  span: number;
  rowSpan: number;
  gridRef: { current: HTMLDivElement | null };
  onRef: (id: WidgetId, el: HTMLDivElement | null) => void;
  title: string;
  icon?: React.ReactNode;
  accentColor?: string;
  action?: React.ReactNode;
  draggingId: WidgetId | null;
  overId: WidgetId | null;
  resizingId: WidgetId | null;
  onOver: (id: WidgetId | null) => void;
  onDragStart: (id: WidgetId) => void;
  onDragEnd: () => void;
  onDrop: (dragId: WidgetId, overId: WidgetId) => void;
  onResize: (id: WidgetId, span: number) => void;
  onResizeStart: (id: WidgetId) => void;
  onResizeEnd: () => void;
  children: React.ReactNode;
}) {
  const isDragging = draggingId === id;
  const isOver = overId === id;
  const isResizing = resizingId === id;
  return (
    <div
      ref={(el) => onRef(id, el)}
      className={styles.widget}
      style={{ gridColumn: `span ${span}`, gridRowEnd: `span ${rowSpan}` }}
      data-dragging={isDragging ? '1' : '0'}
      data-over={isOver ? '1' : '0'}
      data-resizing={isResizing ? '1' : '0'}
      onDragOver={(e) => {
        if (!draggingId || draggingId === id) return;
        e.preventDefault();
        if (!isOver) onOver(id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const dragId = e.dataTransfer.getData('text/plain');
        if (isWidgetId(dragId)) onDrop(dragId, id);
        onOver(null);
      }}
    >
      <div
        className={styles.widgetHeader}
        draggable
        onDragStart={(e) => {
          onDragStart(id);
          e.dataTransfer.setData('text/plain', id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          onOver(null);
          onDragEnd();
        }}
        style={{ borderLeftColor: accentColor }}
      >
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
      <div
        className={styles.widgetResizeHandle}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          onResizeStart(id);
          const grid = gridRef.current;
          if (!grid) return;
          const style = window.getComputedStyle(grid);
          const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0;
          const rect = grid.getBoundingClientRect();
          const colWidth = (rect.width - gap * (GRID_COLS - 1)) / GRID_COLS;
          const startX = e.clientX;
          const startSpan = span;
          let latestX = startX;
          let raf: number | null = null;
          const apply = () => {
            raf = null;
            const delta = latestX - startX;
            const startPx = startSpan * colWidth + (startSpan - 1) * gap;
            const nextPx = Math.max(colWidth, startPx + delta);
            const spanFloat = (nextPx + gap) / (colWidth + gap);
            const nextSpan = clampSpan(spanFloat);
            onResize(id, nextSpan);
          };
          const onMove = (ev: PointerEvent) => {
            latestX = ev.clientX;
            if (raf !== null) return;
            raf = window.requestAnimationFrame(apply);
          };
          const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (raf !== null) window.cancelAnimationFrame(raf);
            onResizeEnd();
          };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        }}
      />
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
