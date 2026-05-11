import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './ToolsPage.module.css';
import type { Category, Module } from '../../types';
import { moduleEntryLoaderMap, modulePluginEntryUrlMap } from '../../data/placeholder';
import PluginHost from '../PluginHost';
import ToolListPanel from '../ToolListPanel';
import ToolTabs, { type OpenTool } from '../ToolTabs';
import { VscScreenFull, VscScreenNormal } from 'react-icons/vsc';

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

export default function ToolsPage({
  categories,
  selectedCategoryId,
  selectedModuleId,
  openedTools,
  onCategorySelect,
  onOpenTool,
  onActivateTool,
  onCloseTool,
  onCloseAllTools,
  marketplacePlugins,
  isFullscreen,
  onSetFullscreen,
  onRequestCollapseSidebar,
}: {
  categories: Category[];
  selectedCategoryId: string;
  selectedModuleId: string | null;
  openedTools: OpenTool[];
  onCategorySelect: (categoryId: string) => void;
  onOpenTool: (categoryId: string, moduleId: string) => void;
  onActivateTool: (moduleId: string) => void;
  onCloseTool: (moduleId: string) => void;
  onCloseAllTools?: () => void;
  marketplacePlugins: { id: string; entryUrl: string }[];
  isFullscreen: boolean;
  onSetFullscreen: (v: boolean) => void;
  onRequestCollapseSidebar?: () => void;
}) {
  const mountedRef = useRef(new Set<string>());
  const corePluginMountedRef = useRef(new Set<string>());
  const marketplaceMountedRef = useRef(new Set<string>());
  const marketplaceEntryMap = new Map(marketplacePlugins.map((p) => [p.id, p.entryUrl]));
  const corePluginEntryMap = modulePluginEntryUrlMap;
  const loadedRef = useRef(new Map<string, React.ComponentType>());
  const loadingRef = useRef(new Set<string>());
  const [, forceLoaded] = useState(0);

  const selectedModule: Module | null = useMemo(() => {
    if (!selectedModuleId) return null;
    for (const c of categories) {
      const m = c.modules.find((x) => x.id === selectedModuleId);
      if (m) return m;
    }
    return null;
  }, [categories, selectedModuleId]);

  if (selectedModule) {
    mountedRef.current.add(selectedModule.id);
    if (corePluginEntryMap.has(selectedModule.id)) corePluginMountedRef.current.add(selectedModule.id);
    if (marketplaceEntryMap.has(selectedModule.id)) marketplaceMountedRef.current.add(selectedModule.id);
  }

  const activeCategory = useMemo(() => {
    if (!selectedModule) return null;
    return categories.find((c) => c.id === selectedModule.categoryId) ?? null;
  }, [categories, selectedModule]);

  const activeColor = selectedModule ? categoryColor(selectedModule.categoryId) : 'var(--accent-secondary)';

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSetFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen, onSetFullscreen]);

  useEffect(() => {
    const ids = Array.from(mountedRef.current);
    for (const moduleId of ids) {
      if (loadedRef.current.has(moduleId)) continue;
      if (loadingRef.current.has(moduleId)) continue;
      const loader = moduleEntryLoaderMap.get(moduleId);
      if (!loader) continue;
      loadingRef.current.add(moduleId);
      void loader()
        .then((m) => {
          loadedRef.current.set(moduleId, m.default);
          loadingRef.current.delete(moduleId);
          forceLoaded((v) => v + 1);
        })
        .catch(() => {
          loadingRef.current.delete(moduleId);
          forceLoaded((v) => v + 1);
        });
    }
  }, [openedTools]);

  return (
    <div
      className={styles.page}
      style={
        isFullscreen
          ? { position: 'fixed', inset: 0, zIndex: 9999, width: '100vw', height: '100vh', background: 'var(--bg-primary)' }
          : undefined
      }
    >
      {!isFullscreen && (
        <ToolListPanel
          categories={categories}
          activeCategoryId={selectedCategoryId}
          activeToolId={selectedModuleId}
          onSelectTool={(categoryId, toolId) => {
            onRequestCollapseSidebar?.();
            if (selectedCategoryId !== 'all') onCategorySelect(categoryId);
            onOpenTool(categoryId, toolId);
          }}
        />
      )}

      <div className={styles.workspace}>
        <div className={`${styles.inner}${isFullscreen ? ` ${styles.innerFullscreen}` : ''}`}>
          {openedTools.length > 0 && (
            <ToolTabs
              categories={categories}
              opened={openedTools}
              activeToolId={selectedModuleId}
              onActivate={onActivateTool}
              onClose={onCloseTool}
              onCloseAll={onCloseAllTools}
            />
          )}

          {selectedModule && (
            <div className={styles.toolHeader}>
              <div className={styles.toolHeaderIcon} style={{ background: `${activeColor}12`, borderColor: `${activeColor}28`, color: activeColor }}>
                {selectedModule.icon}
              </div>
              <div className={styles.toolHeaderMeta}>
                <div className={styles.toolHeaderTitle}>{selectedModule.name}</div>
                <span className={styles.toolHeaderPill} style={{ background: `${activeColor}15`, borderColor: `${activeColor}28`, color: activeColor }}>
                  {activeCategory?.name ?? selectedModule.categoryId}
                </span>
              </div>
              <div className={styles.toolHeaderSpacer} />
              <button
                type="button"
                className={styles.toolHeaderBtn}
                data-active={isFullscreen ? '1' : '0'}
                onClick={() => onSetFullscreen(!isFullscreen)}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <VscScreenNormal /> : <VscScreenFull />}
              </button>
            </div>
          )}

          <div className={styles.content}>
            {openedTools.length === 0 && (
              <div className={styles.empty}>
                <div className={styles.emptyTitle}>Select a tool from the panel</div>
                <div className={styles.emptySubtitle}>Choose from available developer utilities</div>
              </div>
            )}

            {Array.from(mountedRef.current).map((moduleId) => {
              if (corePluginEntryMap.has(moduleId)) return null;
              const Component = loadedRef.current.get(moduleId);
              const isActive = selectedModuleId === moduleId;
              return (
                <div key={moduleId} className={styles.keepAlive} style={{ display: isActive ? undefined : 'none' }}>
                  {Component ? <Component /> : <div className={styles.empty}>Loading...</div>}
                </div>
              );
            })}

            {Array.from(corePluginMountedRef.current).map((moduleId) => {
              const entryUrl = corePluginEntryMap.get(moduleId);
              if (!entryUrl) return null;
              const isActive = selectedModuleId === moduleId;
              return (
                <div key={moduleId} className={styles.keepAlive} style={{ display: isActive ? undefined : 'none' }}>
                  <PluginHost pluginId={moduleId} entryUrl={entryUrl} />
                </div>
              );
            })}

            {Array.from(marketplaceMountedRef.current).map((pluginId) => {
              const entryUrl = marketplaceEntryMap.get(pluginId);
              if (!entryUrl) return null;
              const isActive = selectedModuleId === pluginId;
              return (
                <div key={pluginId} className={styles.keepAlive} style={{ display: isActive ? undefined : 'none' }}>
                  <PluginHost pluginId={pluginId} entryUrl={entryUrl} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
