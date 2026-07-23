import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  VscDebugRestart,
  VscExtensions,
  VscGear,
  VscHome,
  VscLayout,
  VscTools,
  VscWarning,
} from 'react-icons/vsc';
import { HelpModal } from '@devtoolbox/ui';
import type { StartupRestartMode, StartupStatus } from '@devtoolbox/core';

import type { InstalledMarketplacePlugin, MarketplaceRegistryEntry } from './marketplace/types';
import {
  DEFAULT_MARKETPLACE_REGISTRY_URL,
  fetchMarketplaceRegistry,
  getBundledRegistry,
  loadMarketplaceRegistryUrl,
} from './marketplace/registry';
import { compareVersions, isNewerVersion } from './marketplace/version';

import './theme/variables.css';
import './theme/global.css';
import './theme/toolkit.css';
import styles from './App.module.css';

import DashboardPage from './components/DashboardPage';
import AppShell, { type AppShellNavItemId } from './components/AppShell';
import { getCategories } from './data/placeholder';
import { recordModuleUsage } from './data/moduleUsage';
import { I18nProvider, useI18n } from './i18n';
import { runMigrations } from './migrations';
import { ThemeProvider } from './theme';
import type { Module } from './types';
import { marketplacePluginIconFromManifest } from './marketplace/icons';
import { APP_VERSION } from './appVersion';
import { getMarketplaceManifestText } from './marketplace/i18n';
import { recordDiagnostic } from './lib/diagnostics';
import { appService, marketplaceService } from './services';

const AboutDialog = lazy(() => import('./components/AboutDialog'));
const GlobalSearch = lazy(() => import('./components/GlobalSearch'));
const ModulesPage = lazy(() => import('./components/ModulesPage'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const ToolsPage = lazy(() => import('./components/ToolsPage'));
const BackupExportPanel = lazy(() =>
  import('./components/BackupCenter').then((module) => ({ default: module.BackupExportPanel })),
);
const BackupImportPanel = lazy(() =>
  import('./components/BackupCenter').then((module) => ({ default: module.BackupImportPanel })),
);

// Run data migrations on startup
runMigrations(APP_VERSION);

function AppContent({ startupStatus }: { startupStatus: StartupStatus }) {
  const { locale, t } = useI18n();
  const coreCategories = useMemo(() => getCategories(locale), [locale]);

  const [marketplaceInstalled, setMarketplaceInstalled] = useState<InstalledMarketplacePlugin[]>([]);
  const [activePage, setActivePage] = useState<AppShellNavItemId>('dashboard');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [openedTools, setOpenedTools] = useState<Array<{ categoryId: string; moduleId: string }>>([]);
  const [toolsFullscreen, setToolsFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [marketplaceUpdateCount, setMarketplaceUpdateCount] = useState(0);
  const [settingsSection, setSettingsSection] = useState<'appearance' | 'diagnostics'>('appearance');
  const [restartPending, setRestartPending] = useState(false);
  const [restartError, setRestartError] = useState('');
  const safeModeText =
    locale === 'zh-CN'
      ? {
          title: '安全模式已启用',
          detail:
            startupStatus.reason === 'manual'
              ? '本次启动按你的请求暂停了所有 Marketplace 插件，内置工具仍可正常使用。'
              : `检测到 ${startupStatus.consecutiveFailures} 次连续启动未完成。Marketplace 插件已在本次会话暂停。`,
          diagnostics: '查看诊断',
          restart: '正常模式重启',
          restarting: '正在重启…',
          restartFailed: '无法重新启动应用。',
        }
      : {
          title: 'Safe mode is active',
          detail:
            startupStatus.reason === 'manual'
              ? 'Marketplace plugins are paused for this session by request. Built-in tools remain available.'
              : `${startupStatus.consecutiveFailures} consecutive startups did not become healthy. Marketplace plugins are paused for this session.`,
          diagnostics: 'Review diagnostics',
          restart: 'Restart normally',
          restarting: 'Restarting…',
          restartFailed: 'Unable to restart the application.',
        };

  const marketplaceIcon = useCallback(
    (p: { id: string; manifest?: { icon?: unknown; iconKey?: unknown } }) => {
      const icon = p.manifest?.icon;
      const iconKey = p.manifest?.iconKey;
      return marketplacePluginIconFromManifest({ id: p.id, icon, iconKey });
    },
    [],
  );

  const refreshMarketplaceUpdateCount = useCallback(
    async (installed: InstalledMarketplacePlugin[]) => {
      if (startupStatus.safeMode) {
        setMarketplaceUpdateCount(0);
        return;
      }
      const bundled = getBundledRegistry();
      const url = loadMarketplaceRegistryUrl() || DEFAULT_MARKETPLACE_REGISTRY_URL;
      const registry = await fetchMarketplaceRegistry(url).catch(() => bundled);

      const latest = new Map<string, MarketplaceRegistryEntry>();
      for (const e of registry.plugins) {
        const id = e?.manifest?.id;
        if (!id) continue;
        const cur = latest.get(id);
        if (!cur) {
          latest.set(id, e);
          continue;
        }
        const nextV = String(e.manifest?.version ?? '');
        const curV = String(cur.manifest?.version ?? '');
        if (compareVersions(nextV, curV) > 0) latest.set(id, e);
      }

      const count = installed.reduce((acc, p) => {
        const e = latest.get(p.id);
        const remoteV = String(e?.manifest?.version ?? '');
        const localV = String(p.version ?? '');
        if (remoteV && localV && isNewerVersion(remoteV, localV)) return acc + 1;
        return acc;
      }, 0);
      setMarketplaceUpdateCount(count);
    },
    [startupStatus.safeMode],
  );

  const restartApplication = useCallback(
    async (mode: StartupRestartMode): Promise<boolean> => {
      const restart = appService.restart(mode);
      if (!restart) return false;
      setRestartPending(true);
      setRestartError('');
      try {
        const accepted = await restart;
        if (!accepted) {
          setRestartPending(false);
          setRestartError(safeModeText.restartFailed);
        }
        return accepted;
      } catch {
        setRestartPending(false);
        setRestartError(safeModeText.restartFailed);
        return false;
      }
    },
    [safeModeText.restartFailed],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const request = appService.rendererReady();
      if (request) {
        void request.catch((error: unknown) => {
          recordDiagnostic({
            level: 'warn',
            source: 'renderer',
            scope: 'startup.health',
            message: 'Unable to confirm renderer startup health',
            details: error,
          });
        });
      }
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = () => {
      setSettingsSection('appearance');
      setActivePage('settings');
    };
    return appService.onOpenSettings(handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowAbout(true);
    return appService.onOpenAbout(handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowExport(true);
    return appService.onOpenExport(handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowImport(true);
    return appService.onOpenImport(handler);
  }, []);

  useEffect(() => {
    if (!selectedCategoryId) setSelectedCategoryId('all');
  }, [coreCategories, selectedCategoryId]);

  useEffect(() => {
    if (activePage !== 'tools') {
      setToolsFullscreen(false);
      setSidebarCollapsed(false);
    }
  }, [activePage]);

  useEffect(() => {
    if (activePage !== 'tools') return;
    const hasToolOpen = Boolean(selectedModuleId) || openedTools.length > 0;
    if (hasToolOpen) {
      setSidebarCollapsed(true);
      return;
    }
    if (!toolsFullscreen) setSidebarCollapsed(false);
  }, [activePage, openedTools.length, selectedModuleId, toolsFullscreen]);

  const handleMarketplaceUpdated = useCallback(
    (list: InstalledMarketplacePlugin[]) => {
      setMarketplaceInstalled(list);
      void refreshMarketplaceUpdateCount(list);
    },
    [refreshMarketplaceUpdateCount],
  );

  const refreshMarketplace = useCallback(async () => {
    const listInstalled = marketplaceService.listInstalled();
    if (!listInstalled) return;
    try {
      const installed = await listInstalled;
      setMarketplaceInstalled(installed);
      void refreshMarketplaceUpdateCount(installed);
    } catch (error) {
      recordDiagnostic({
        level: 'warn',
        source: 'renderer',
        scope: 'marketplace.list-installed',
        message: 'Unable to load installed Marketplace plugins',
        details: error,
      });
    }
  }, [refreshMarketplaceUpdateCount]);

  useEffect(() => {
    void refreshMarketplace();
  }, [refreshMarketplace]);

  useEffect(() => {
    const handler = () => void refreshMarketplaceUpdateCount(marketplaceInstalled);
    window.addEventListener('devtoolbox:registryUrlChanged', handler);
    return () => window.removeEventListener('devtoolbox:registryUrlChanged', handler);
  }, [marketplaceInstalled, refreshMarketplaceUpdateCount]);

  const categories = useMemo(() => {
    const map = new Map(coreCategories.map((c) => [c.id, { ...c, modules: [...c.modules] }]));
    const coreIds = new Set(coreCategories.flatMap((c) => c.modules.map((m) => m.id)));
    if (startupStatus.safeMode) return Array.from(map.values());
    for (const p of marketplaceInstalled) {
      if (!p.enabled) continue;
      if (coreIds.has(p.id)) continue;
      const cat = map.get(p.manifest.categoryId);
      if (!cat) continue;
      const text = getMarketplaceManifestText(p.manifest, locale);
      cat.modules.push({
        id: p.id,
        name: text.name,
        description: text.description,
        categoryId: p.manifest.categoryId,
        icon: marketplaceIcon(p),
      });
    }
    return Array.from(map.values());
  }, [coreCategories, locale, marketplaceIcon, marketplaceInstalled, startupStatus.safeMode]);

  const toolCategories = useMemo(() => {
    const allModules: Module[] = categories.flatMap((c) => c.modules);
    return [
      {
        id: 'all',
        name: 'All Tools',
        icon: <VscLayout />,
        modules: allModules,
      },
      ...categories,
    ];
  }, [categories]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowGlobalSearch((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleCategorySelect = (categoryId: string) => {
    setActivePage('tools');
    setSelectedCategoryId(categoryId);
  };

  const handleDashboardModuleSelect = (categoryId: string, moduleId: string) => {
    setActivePage('tools');
    setSelectedCategoryId(categoryId);
    setSelectedModuleId(moduleId);
    setOpenedTools((prev) =>
      prev.some((t) => t.moduleId === moduleId) ? prev : [...prev, { categoryId, moduleId }],
    );
    recordModuleUsage(categoryId, moduleId);
  };

  const handleGlobalSearchSelect = useCallback((categoryId: string, moduleId: string) => {
    setActivePage('tools');
    setSelectedCategoryId(categoryId);
    setSelectedModuleId(moduleId);
    setOpenedTools((prev) =>
      prev.some((t) => t.moduleId === moduleId) ? prev : [...prev, { categoryId, moduleId }],
    );
    recordModuleUsage(categoryId, moduleId);
  }, []);

  const handleOpenTool = useCallback((categoryId: string, moduleId: string) => {
    setActivePage('tools');
    setSelectedCategoryId((prev) => (prev === 'all' ? prev : categoryId));
    setSelectedModuleId(moduleId);
    setOpenedTools((prev) =>
      prev.some((t) => t.moduleId === moduleId) ? prev : [...prev, { categoryId, moduleId }],
    );
    recordModuleUsage(categoryId, moduleId);
  }, []);

  const handleCloseTool = useCallback(
    (moduleId: string) => {
      setOpenedTools((prev) => {
        const next = prev.filter((t) => t.moduleId !== moduleId);
        if (selectedModuleId === moduleId) {
          const fallback = next[next.length - 1]?.moduleId ?? null;
          setSelectedModuleId(fallback);
        }
        return next;
      });
    },
    [selectedModuleId],
  );

  const handleCloseAllTools = useCallback(() => {
    setOpenedTools([]);
    setSelectedModuleId(null);
  }, []);

  const marketplacePlugins = useMemo(
    () =>
      startupStatus.safeMode
        ? []
        : marketplaceInstalled.filter((p) => p.enabled).map((p) => ({ id: p.id, entryUrl: p.entryUrl })),
    [marketplaceInstalled, startupStatus.safeMode],
  );

  const navItems = useMemo(
    () => [
      { id: 'dashboard' as const, label: t('nav.dashboard'), icon: <VscHome /> },
      { id: 'tools' as const, label: t('nav.tools'), icon: <VscTools /> },
      {
        id: 'modules' as const,
        label: t('nav.modules'),
        icon: <VscExtensions />,
        badge: marketplaceUpdateCount,
      },
      { id: 'settings' as const, label: t('nav.settings'), icon: <VscGear /> },
    ],
    [marketplaceUpdateCount, t],
  );

  return (
    <div className={styles.app}>
      {startupStatus.safeMode && (
        <div className={styles.safeModeBanner} role="status">
          <span className={styles.safeModeIcon} aria-hidden="true">
            <VscWarning />
          </span>
          <div className={styles.safeModeCopy}>
            <div className={styles.safeModeTitle}>{safeModeText.title}</div>
            <div className={styles.safeModeDetail}>{safeModeText.detail}</div>
            {restartError && <div className={styles.safeModeError}>{restartError}</div>}
          </div>
          <div className={styles.safeModeActions}>
            <button
              type="button"
              className={styles.safeModeButton}
              onClick={() => {
                setSettingsSection('diagnostics');
                setActivePage('settings');
              }}
            >
              {safeModeText.diagnostics}
            </button>
            <button
              type="button"
              className={styles.safeModePrimaryButton}
              disabled={restartPending}
              onClick={() => void restartApplication('normal')}
            >
              <VscDebugRestart />
              {restartPending ? safeModeText.restarting : safeModeText.restart}
            </button>
          </div>
        </div>
      )}
      <div className={styles.shellFrame}>
        <AppShell
          navItems={navItems}
          activeNavId={activePage}
          onNavSelect={(id) => {
            if (id === 'settings') setSettingsSection('appearance');
            setActivePage(id);
            if (id !== 'tools') setSelectedModuleId(null);
          }}
          categories={toolCategories}
          activeCategoryId={selectedCategoryId}
          onCategorySelect={handleCategorySelect}
          sidebarHidden={activePage === 'tools' && toolsFullscreen}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        >
          <Suspense fallback={<div className={styles.pageLoading}>Loading...</div>}>
            {activePage === 'dashboard' && (
              <DashboardPage
                categories={categories}
                onOpenTool={handleDashboardModuleSelect}
                onCategorySelect={handleCategorySelect}
              />
            )}

            {activePage === 'tools' && (
              <ToolsPage
                categories={toolCategories}
                selectedCategoryId={selectedCategoryId}
                selectedModuleId={selectedModuleId}
                openedTools={
                  openedTools
                    .map((t) => {
                      const category = categories.find((c) => c.id === t.categoryId);
                      const module = category?.modules.find((m) => m.id === t.moduleId);
                      if (!category || !module) return null;
                      return { categoryId: t.categoryId, module };
                    })
                    .filter(Boolean) as Array<{ categoryId: string; module: Module }>
                }
                onCategorySelect={handleCategorySelect}
                onOpenTool={handleOpenTool}
                onActivateTool={(moduleId) => setSelectedModuleId(moduleId)}
                onCloseTool={handleCloseTool}
                onCloseAllTools={handleCloseAllTools}
                marketplacePlugins={marketplacePlugins}
                isFullscreen={toolsFullscreen}
                onSetFullscreen={setToolsFullscreen}
                onRequestCollapseSidebar={() => setSidebarCollapsed(true)}
              />
            )}

            {activePage === 'modules' && <ModulesPage onUpdated={handleMarketplaceUpdated} />}

            {activePage === 'settings' && (
              <SettingsPage
                initialSection={settingsSection}
                startupStatus={startupStatus}
                onRestart={restartApplication}
              />
            )}
          </Suspense>
        </AppShell>
      </div>

      {showExport && (
        <HelpModal title="Export..." size="sm" onClose={() => setShowExport(false)}>
          <Suspense fallback={<div className={styles.dialogLoading}>Loading...</div>}>
            <BackupExportPanel />
          </Suspense>
        </HelpModal>
      )}

      {showImport && (
        <HelpModal title="Import..." size="sm" onClose={() => setShowImport(false)}>
          <Suspense fallback={<div className={styles.dialogLoading}>Loading...</div>}>
            <BackupImportPanel />
          </Suspense>
        </HelpModal>
      )}

      {showAbout && (
        <Suspense fallback={null}>
          <AboutDialog isOpen onClose={() => setShowAbout(false)} />
        </Suspense>
      )}
      {showGlobalSearch && (
        <Suspense fallback={null}>
          <GlobalSearch
            onSelect={handleGlobalSearchSelect}
            onClose={() => setShowGlobalSearch(false)}
            extraModules={marketplaceInstalled
              .filter((p) => p.enabled && !startupStatus.safeMode)
              .map((p) => ({
                module: {
                  id: p.id,
                  name: p.manifest.name,
                  description: p.manifest.description,
                  categoryId: p.manifest.categoryId,
                  icon: marketplaceIcon(p),
                },
                categoryId: p.manifest.categoryId,
                categoryName:
                  categories.find((c) => c.id === p.manifest.categoryId)?.name ?? p.manifest.categoryId,
              }))}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App({ startupStatus }: { startupStatus: StartupStatus }) {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AppContent startupStatus={startupStatus} />
      </ThemeProvider>
    </I18nProvider>
  );
}
