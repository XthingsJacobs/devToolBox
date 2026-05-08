import { useCallback, useEffect, useMemo, useState } from 'react';
import { VscArrowSwap, VscCircuitBoard, VscExtensions, VscGear, VscHome, VscLayout, VscLocation, VscTools } from 'react-icons/vsc';
import { HelpModal } from '@devtoolbox/ui';

import type { InstalledMarketplacePlugin } from './marketplace/types';
import type { MarketplaceRegistryEntry } from './marketplace/types';
import { DEFAULT_MARKETPLACE_REGISTRY_URL, fetchMarketplaceRegistry, getBundledRegistry, loadMarketplaceRegistryUrl } from './marketplace/registry';
import { compareVersions, isNewerVersion } from './marketplace/version';

import './theme/variables.css';
import './theme/global.css';
import './theme/toolkit.css';
import styles from './App.module.css';

import AboutDialog from './components/AboutDialog';
import { BackupExportPanel, BackupImportPanel } from './components/BackupCenter';
import DashboardPage from './components/DashboardPage';
import GlobalSearch from './components/GlobalSearch';
import ModulesPage from './components/ModulesPage';
import SettingsPage from './components/SettingsV2';
import AppShell, { type AppShellNavItemId } from './components/AppShell';
import ToolsPage from './components/ToolsPage';
import { getCategories } from './data/placeholder';
import { recordModuleUsage } from './data/moduleUsage';
import { I18nProvider, useI18n } from './i18n';
import { runMigrations } from './migrations';
import { ThemeProvider } from './theme';
import type { Module } from './types';

// Keep in sync with package.json
const APP_VERSION = '2.0.0';
// Run data migrations on startup
runMigrations(APP_VERSION);

function AppContent() {
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

  const marketplaceIcon = useCallback((id: string) => {
    if (id === 'market-matter-catalog') return <VscCircuitBoard />;
    if (id === 'market-ip-lookup') return <VscLocation />;
    if (id === 'market-exchange-rate') return <VscArrowSwap />;
    return <VscExtensions />;
  }, []);

  const refreshMarketplaceUpdateCount = useCallback(async (installed: InstalledMarketplacePlugin[]) => {
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
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenSettings || !api?.offOpenSettings) return;
    const handler = () => {
      setActivePage('settings');
    };
    api.onOpenSettings(handler);
    return () => api.offOpenSettings(handler);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenAbout || !api?.offOpenAbout) return;
    const handler = () => setShowAbout(true);
    api.onOpenAbout(handler);
    return () => api.offOpenAbout(handler);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenExport || !api?.offOpenExport) return;
    const handler = () => setShowExport(true);
    api.onOpenExport(handler);
    return () => api.offOpenExport(handler);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenImport || !api?.offOpenImport) return;
    const handler = () => setShowImport(true);
    api.onOpenImport(handler);
    return () => api.offOpenImport(handler);
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

  const handleMarketplaceUpdated = useCallback((list: InstalledMarketplacePlugin[]) => {
    setMarketplaceInstalled(list);
    void refreshMarketplaceUpdateCount(list);
  }, [refreshMarketplaceUpdateCount]);

  const refreshMarketplace = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.marketplaceListInstalled) return;
    const list = await api.marketplaceListInstalled();
    const installed = list as InstalledMarketplacePlugin[];
    setMarketplaceInstalled(installed);
    void refreshMarketplaceUpdateCount(installed);
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
    for (const p of marketplaceInstalled) {
      if (!p.enabled) continue;
      if (coreIds.has(p.id)) continue;
      const cat = map.get(p.manifest.categoryId);
      if (!cat) continue;
      cat.modules.push({
        id: p.id,
        name: p.manifest.name,
        description: p.manifest.description,
        categoryId: p.manifest.categoryId,
        icon: marketplaceIcon(p.id),
      });
    }
    return Array.from(map.values());
  }, [coreCategories, marketplaceIcon, marketplaceInstalled]);

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
    setOpenedTools((prev) => (prev.some((t) => t.moduleId === moduleId) ? prev : [...prev, { categoryId, moduleId }]));
    recordModuleUsage(categoryId, moduleId);
  };

  const handleGlobalSearchSelect = useCallback((categoryId: string, moduleId: string) => {
    setActivePage('tools');
    setSelectedCategoryId(categoryId);
    setSelectedModuleId(moduleId);
    setOpenedTools((prev) => (prev.some((t) => t.moduleId === moduleId) ? prev : [...prev, { categoryId, moduleId }]));
    recordModuleUsage(categoryId, moduleId);
  }, []);

  const handleOpenTool = useCallback((categoryId: string, moduleId: string) => {
    setActivePage('tools');
    setSelectedCategoryId((prev) => (prev === 'all' ? prev : categoryId));
    setSelectedModuleId(moduleId);
    setOpenedTools((prev) => (prev.some((t) => t.moduleId === moduleId) ? prev : [...prev, { categoryId, moduleId }]));
    recordModuleUsage(categoryId, moduleId);
  }, []);

  const handleCloseTool = useCallback((moduleId: string) => {
    setOpenedTools((prev) => {
      const next = prev.filter((t) => t.moduleId !== moduleId);
      if (selectedModuleId === moduleId) {
        const fallback = next[next.length - 1]?.moduleId ?? null;
        setSelectedModuleId(fallback);
      }
      return next;
    });
  }, [selectedModuleId]);

  const marketplacePlugins = useMemo(
    () => marketplaceInstalled.filter((p) => p.enabled).map((p) => ({ id: p.id, entryUrl: p.entryUrl })),
    [marketplaceInstalled],
  );

  const navItems = useMemo(
    () => [
      { id: 'dashboard' as const, label: t('nav.dashboard'), icon: <VscHome /> },
      { id: 'tools' as const, label: t('nav.tools'), icon: <VscTools /> },
      { id: 'modules' as const, label: t('nav.modules'), icon: <VscExtensions />, badge: marketplaceUpdateCount },
      { id: 'settings' as const, label: t('nav.settings'), icon: <VscGear /> },
    ],
    [marketplaceUpdateCount, t],
  );

  return (
    <div className={styles.app}>
      <AppShell
        navItems={navItems}
        activeNavId={activePage}
        onNavSelect={(id) => {
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
            openedTools={openedTools
              .map((t) => {
                const category = categories.find((c) => c.id === t.categoryId);
                const module = category?.modules.find((m) => m.id === t.moduleId);
                if (!category || !module) return null;
                return { categoryId: t.categoryId, module };
              })
              .filter(Boolean) as Array<{ categoryId: string; module: Module }>}
            onCategorySelect={handleCategorySelect}
            onOpenTool={handleOpenTool}
            onActivateTool={(moduleId) => setSelectedModuleId(moduleId)}
            onCloseTool={handleCloseTool}
            marketplacePlugins={marketplacePlugins}
            isFullscreen={toolsFullscreen}
            onSetFullscreen={setToolsFullscreen}
            onRequestCollapseSidebar={() => setSidebarCollapsed(true)}
          />
        )}

        {activePage === 'modules' && (
          <ModulesPage onUpdated={handleMarketplaceUpdated} />
        )}

        {activePage === 'settings' && (
          <SettingsPage />
        )}
      </AppShell>

      {showExport && (
        <HelpModal title="Export..." size="sm" onClose={() => setShowExport(false)}>
          <BackupExportPanel />
        </HelpModal>
      )}

      {showImport && (
        <HelpModal title="Import..." size="sm" onClose={() => setShowImport(false)}>
          <BackupImportPanel />
        </HelpModal>
      )}

      <AboutDialog isOpen={showAbout} onClose={() => setShowAbout(false)} />
      {showGlobalSearch && (
        <GlobalSearch
          onSelect={handleGlobalSearchSelect}
          onClose={() => setShowGlobalSearch(false)}
          extraModules={marketplaceInstalled
            .filter((p) => p.enabled)
            .map((p) => ({
              module: {
                id: p.id,
                name: p.manifest.name,
                description: p.manifest.description,
                categoryId: p.manifest.categoryId,
                icon: marketplaceIcon(p.id),
              },
              categoryId: p.manifest.categoryId,
              categoryName: categories.find((c) => c.id === p.manifest.categoryId)?.name ?? p.manifest.categoryId,
            }))}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </I18nProvider>
  );
}
