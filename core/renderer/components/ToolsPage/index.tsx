import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import styles from './ToolsPage.module.css';
import type { Category, Module } from '../../types';
import { moduleEntryLoaderMap, modulePluginEntryUrlMap } from '../../data/placeholder';
import PluginHost from '../PluginHost';
import ToolListPanel from '../ToolListPanel';
import ToolTabs, { type OpenTool } from '../ToolTabs';
import { VscScreenFull, VscScreenNormal } from 'react-icons/vsc';
import { recordDiagnostic } from '../../lib/diagnostics';

interface ToolFailurePanelProps {
  toolName: string;
  message: string;
  onRetry: () => void;
  onClose?: () => void;
}

function ToolFailurePanel({ toolName, message, onRetry, onClose }: ToolFailurePanelProps) {
  return (
    <div className={styles.failure} role="alert">
      <div className={styles.failureCard}>
        <div className={styles.failureEyebrow}>Tool unavailable</div>
        <h2 className={styles.failureTitle}>{toolName}</h2>
        <p className={styles.failureMessage}>{message}</p>
        <div className={styles.failureActions}>
          <button type="button" className={styles.failurePrimaryButton} onClick={onRetry}>
            Retry
          </button>
          {onClose && (
            <button type="button" className={styles.failureButton} onClick={onClose}>
              Close tool
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ToolRuntimeBoundaryProps {
  toolName: string;
  children: ReactNode;
  onRetry: () => void;
  onClose?: () => void;
}

interface ToolRuntimeBoundaryState {
  error: Error | null;
}

export class ToolRuntimeBoundary extends Component<ToolRuntimeBoundaryProps, ToolRuntimeBoundaryState> {
  state: ToolRuntimeBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ToolRuntimeBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordDiagnostic({
      level: 'error',
      source: 'tool',
      scope: this.props.toolName,
      message: error.message || 'Tool runtime failed',
      details: { error, componentStack: info.componentStack },
    });
    console.error(`Tool runtime failed: ${this.props.toolName}`, error, info.componentStack);
  }

  private retry = () => {
    this.props.onRetry();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ToolFailurePanel
          toolName={this.props.toolName}
          message={this.state.error.message || 'The tool stopped unexpectedly.'}
          onRetry={this.retry}
          onClose={this.props.onClose}
        />
      );
    }
    return this.props.children;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'The tool could not be loaded.';
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
  const loadErrorsRef = useRef(new Map<string, string>());
  const runtimeVersionsRef = useRef(new Map<string, number>());
  const [, forceLoaded] = useState(0);
  const [loadRequestRevision, requestLoad] = useState(0);

  const toolNameById = useMemo(
    () =>
      new Map(categories.flatMap((category) => category.modules.map((module) => [module.id, module.name]))),
    [categories],
  );

  const selectedModule: Module | null = useMemo(() => {
    if (!selectedModuleId) return null;
    for (const c of categories) {
      const m = c.modules.find((x) => x.id === selectedModuleId);
      if (m) return m;
    }
    return null;
  }, [categories, selectedModuleId]);

  if (selectedModule) {
    const id = selectedModule.id;
    if (marketplaceEntryMap.has(id)) marketplaceMountedRef.current.add(id);
    else if (corePluginEntryMap.has(id)) corePluginMountedRef.current.add(id);
    else mountedRef.current.add(id);
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
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.repeat) return;
      const key = typeof e.key === 'string' ? e.key.toLowerCase() : '';
      if (key !== 'w') return;
      if (!e.metaKey && !e.ctrlKey) return;
      if (!selectedModuleId) return;
      e.preventDefault();
      onCloseTool(selectedModuleId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCloseTool, selectedModuleId]);

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
          loadErrorsRef.current.delete(moduleId);
          loadingRef.current.delete(moduleId);
          forceLoaded((v) => v + 1);
        })
        .catch((error: unknown) => {
          loadErrorsRef.current.set(moduleId, errorMessage(error));
          loadingRef.current.delete(moduleId);
          forceLoaded((v) => v + 1);
        });
    }
  }, [loadRequestRevision, openedTools]);

  const retryTool = (moduleId: string) => {
    loadedRef.current.delete(moduleId);
    loadingRef.current.delete(moduleId);
    loadErrorsRef.current.delete(moduleId);
    runtimeVersionsRef.current.set(moduleId, (runtimeVersionsRef.current.get(moduleId) ?? 0) + 1);
    requestLoad((v) => v + 1);
  };

  return (
    <div
      className={styles.page}
      style={
        isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              width: '100vw',
              height: '100vh',
              background: 'var(--bg-primary)',
            }
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
              <div
                className={styles.toolHeaderIcon}
                style={{
                  background: `${activeColor}12`,
                  borderColor: `${activeColor}28`,
                  color: activeColor,
                }}
              >
                {selectedModule.icon}
              </div>
              <div className={styles.toolHeaderMeta}>
                <div className={styles.toolHeaderTitle}>{selectedModule.name}</div>
                <span
                  className={styles.toolHeaderPill}
                  style={{
                    background: `${activeColor}15`,
                    borderColor: `${activeColor}28`,
                    color: activeColor,
                  }}
                >
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
              const loadError = loadErrorsRef.current.get(moduleId);
              const isActive = selectedModuleId === moduleId;
              const toolName = toolNameById.get(moduleId) ?? moduleId;
              const runtimeVersion = runtimeVersionsRef.current.get(moduleId) ?? 0;
              return (
                <div
                  key={moduleId}
                  className={styles.keepAlive}
                  style={{ display: isActive ? undefined : 'none' }}
                >
                  {loadError ? (
                    <ToolFailurePanel
                      toolName={toolName}
                      message={loadError}
                      onRetry={() => retryTool(moduleId)}
                      onClose={() => onCloseTool(moduleId)}
                    />
                  ) : Component ? (
                    <ToolRuntimeBoundary
                      key={`${moduleId}:${runtimeVersion}`}
                      toolName={toolName}
                      onRetry={() => retryTool(moduleId)}
                      onClose={() => onCloseTool(moduleId)}
                    >
                      <Component />
                    </ToolRuntimeBoundary>
                  ) : (
                    <div className={styles.empty}>Loading...</div>
                  )}
                </div>
              );
            })}

            {Array.from(corePluginMountedRef.current).map((moduleId) => {
              const entryUrl = corePluginEntryMap.get(moduleId);
              if (!entryUrl) return null;
              const isActive = selectedModuleId === moduleId;
              const toolName = toolNameById.get(moduleId) ?? moduleId;
              const runtimeVersion = runtimeVersionsRef.current.get(moduleId) ?? 0;
              return (
                <div
                  key={moduleId}
                  className={styles.keepAlive}
                  style={{ display: isActive ? undefined : 'none' }}
                >
                  <ToolRuntimeBoundary
                    key={`${moduleId}:${runtimeVersion}`}
                    toolName={toolName}
                    onRetry={() => retryTool(moduleId)}
                    onClose={() => onCloseTool(moduleId)}
                  >
                    <PluginHost pluginId={moduleId} entryUrl={entryUrl} />
                  </ToolRuntimeBoundary>
                </div>
              );
            })}

            {Array.from(marketplaceMountedRef.current).map((pluginId) => {
              const entryUrl = marketplaceEntryMap.get(pluginId);
              if (!entryUrl) return null;
              const isActive = selectedModuleId === pluginId;
              const toolName = toolNameById.get(pluginId) ?? pluginId;
              const runtimeVersion = runtimeVersionsRef.current.get(pluginId) ?? 0;
              return (
                <div
                  key={pluginId}
                  className={styles.keepAlive}
                  style={{ display: isActive ? undefined : 'none' }}
                >
                  <ToolRuntimeBoundary
                    key={`${pluginId}:${runtimeVersion}`}
                    toolName={toolName}
                    onRetry={() => retryTool(pluginId)}
                    onClose={() => onCloseTool(pluginId)}
                  >
                    <PluginHost pluginId={pluginId} entryUrl={entryUrl} />
                  </ToolRuntimeBoundary>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
