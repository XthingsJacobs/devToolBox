import type { LegacyRef, ReactNode } from 'react';
import {
  VscBroadcast,
  VscChevronRight,
  VscDeviceMobile,
  VscGraph,
  VscInfo,
  VscScreenFull,
} from 'react-icons/vsc';
import ReactGridLayout, { verticalCompactor } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import styles from './DashboardPage.module.css';
import { GRID_AUTO_ROW_PX, GRID_COLS, GRID_GAP_PX, type FlatTool } from './DashboardPage.model';
import type { DashboardGridLayoutController } from './useDashboardGridLayout';
import type { DashboardAppInfo } from './useDashboardData';
import type { NetworkInfo } from '@devtoolbox/core';

type NavigatorLike = Navigator & { vendor?: string; platform?: string };

export function DashboardWidgets({
  grid,
  frequent,
  appInfo,
  networkInfo,
  now,
  onOpenTool,
  onCategorySelect,
}: {
  grid: DashboardGridLayoutController;
  frequent: FlatTool[];
  appInfo: DashboardAppInfo | null;
  networkInfo: NetworkInfo | null;
  now: Date;
  onOpenTool: (categoryId: string, moduleId: string) => void;
  onCategorySelect: (categoryId: string) => void;
}) {
  return (
    <div ref={grid.containerRef as LegacyRef<HTMLDivElement>} className={styles.widgetGrid}>
      {grid.mounted ? (
        <ReactGridLayout
          width={grid.width}
          layout={grid.layout}
          compactor={verticalCompactor}
          gridConfig={{
            cols: GRID_COLS,
            rowHeight: GRID_AUTO_ROW_PX,
            margin: [GRID_GAP_PX, GRID_GAP_PX],
            containerPadding: [0, 0],
            maxRows: Number.POSITIVE_INFINITY,
          }}
          dragConfig={{
            enabled: true,
            bounded: true,
            handle: `.${styles.widgetHeader}`,
            cancel: '.react-resizable-handle',
            threshold: 3,
          }}
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
          onDragStart={grid.handleDragStart}
          onResizeStart={grid.handleResizeStart}
          onLayoutChange={grid.handleLayoutChange}
          onDragStop={grid.handleDragStop}
          onResizeStop={grid.handleResizeStop}
        >
          <div key="frequent">
            <Widget
              title="Frequent Tools"
              icon={<VscGraph />}
              accentColor="var(--accent-secondary)"
              action={
                <button
                  type="button"
                  className={styles.widgetAction}
                  draggable={false}
                  onClick={() => onCategorySelect('all')}
                >
                  View All Tools
                  <VscChevronRight />
                </button>
              }
            >
              <div className={styles.grid}>
                {frequent.slice(0, 8).map((tool) => (
                  <button
                    key={tool.module.id}
                    type="button"
                    className={styles.toolCard}
                    onClick={() => onOpenTool(tool.categoryId, tool.module.id)}
                  >
                    <div className={styles.toolCardTop}>
                      <div
                        className={styles.toolCardIcon}
                        style={{
                          color: tool.categoryColor,
                          background: `${tool.categoryColor}15`,
                          borderColor: `${tool.categoryColor}28`,
                        }}
                      >
                        {tool.module.icon}
                      </div>
                      <div className={styles.toolCardMeta}>
                        <div className={styles.toolCardName}>{tool.module.name}</div>
                        <span
                          className={styles.toolCardPill}
                          style={{ color: tool.categoryColor, background: `${tool.categoryColor}15` }}
                        >
                          {tool.categoryName}
                        </span>
                      </div>
                    </div>
                    <div className={styles.toolCardDesc}>{tool.module.description}</div>
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
                    ok:
                      (networkInfo?.internetStatus ?? (navigator.onLine ? 'Connected' : 'Disconnected')) ===
                      'Connected',
                  },
                  {
                    label: 'DNS',
                    value: networkInfo?.dnsStatus ?? '-',
                    ok: (networkInfo?.dnsStatus ?? '') === 'OK',
                  },
                  { label: 'Public IP', value: networkInfo?.publicIP ?? '-' },
                  {
                    label: 'Local IP',
                    value: (networkInfo?.localIPs ?? ['-']).join('\n'),
                    wrap: true,
                    mono: true,
                    pre: true,
                  },
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
                  {
                    label: 'Orientation angle',
                    value: `${Number(window.screen.orientation?.angle ?? 0)}°`,
                  },
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
                    value: Array.isArray(navigator.languages)
                      ? navigator.languages.join(', ')
                      : String(navigator.language ?? '-'),
                  },
                  {
                    label: 'Platform',
                    value: String((navigator as NavigatorLike).platform ?? 'Unknown'),
                  },
                  { label: 'User agent', value: navigator.userAgent, wrap: true, mono: false },
                ]}
              />
            </Widget>
          </div>
        </ReactGridLayout>
      ) : null}
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
  icon?: ReactNode;
  accentColor?: string;
  action?: ReactNode;
  children: ReactNode;
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
        <div className={styles.widgetHeaderRight} onMouseDown={(event) => event.stopPropagation()}>
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
        <div
          key={`${item.label}-${item.value}`}
          className={`${styles.infoRow}${item.wrap ? ` ${styles.infoRowWrap}` : ''}`}
        >
          <span className={styles.infoLabel}>{item.label}</span>
          <span
            className={`${styles.infoValue}${item.wrap && item.mono === false ? ` ${styles.infoValueInherit}` : ''}`}
          >
            {typeof item.ok === 'boolean' && <span className={styles.dot} data-ok={item.ok ? '1' : '0'} />}
            <span className={`${styles.infoValueText}${item.pre ? ` ${styles.infoValuePre}` : ''}`}>
              {item.value}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
