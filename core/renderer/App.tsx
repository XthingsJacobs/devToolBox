import { useCallback, useEffect, useMemo, useState } from 'react';
import { VscAdd, VscHome } from 'react-icons/vsc';
import { HelpModal } from '@devtoolbox/ui';

import type { Module } from './types';
import type { InstalledMarketplacePlugin } from './marketplace/types';

import './theme/variables.css';
import styles from './App.module.css';

import { BackupExportPanel, BackupImportPanel } from './components/BackupCenter';
import ContentArea from './components/ContentArea';
import GlobalSearch from './components/GlobalSearch';
import PluginManager from './components/PluginManager';
import SettingsPage from './components/SettingsPage';
import TopNav from './components/TopNav';
import { getCategories } from './data/placeholder';
import { recordModuleUsage } from './data/moduleUsage';
import { I18nProvider, useI18n } from './i18n';
import { runMigrations } from './migrations';

// Keep in sync with package.json
const APP_VERSION = '1.0.0';
// Run data migrations on startup
runMigrations(APP_VERSION);

function AppContent() {
  const { locale, t } = useI18n();
  const coreCategories = useMemo(() => getCategories(locale), [locale]);

  const [marketplaceInstalled, setMarketplaceInstalled] = useState<InstalledMarketplacePlugin[]>([]);
  const [activePage, setActivePage] = useState<'dashboard' | 'tools'>('dashboard');
  const [selectedCategoryId, setSelectedCategoryId] = useState(coreCategories[0]?.id ?? '');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showPluginManager, setShowPluginManager] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onOpenSettings || !api?.offOpenSettings) return;
    const handler = () => {
      setShowSettings(true);
    };
    api.onOpenSettings(handler);
    return () => api.offOpenSettings(handler);
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
    if (!selectedCategoryId && coreCategories[0]?.id) setSelectedCategoryId(coreCategories[0].id);
  }, [coreCategories, selectedCategoryId]);

  const handleMarketplaceUpdated = useCallback((list: InstalledMarketplacePlugin[]) => {
    setMarketplaceInstalled(list);
  }, []);

  const refreshMarketplace = useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.marketplaceListInstalled) return;
    const list = await api.marketplaceListInstalled();
    setMarketplaceInstalled(list as InstalledMarketplacePlugin[]);
  }, []);

  useEffect(() => {
    void refreshMarketplace();
  }, [refreshMarketplace]);

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
      });
    }
    return Array.from(map.values());
  }, [coreCategories, marketplaceInstalled]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowGlobalSearch((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const modules = selectedCategory?.modules ?? [];
  const selectedModule: Module | null = modules.find((m) => m.id === selectedModuleId) ?? null;

  const handleCategorySelect = (categoryId: string) => {
    setActivePage('tools');
    setSelectedCategoryId(categoryId);
    setSelectedModuleId(null);
  };

  const handleDashboardModuleSelect = (categoryId: string, moduleId: string) => {
    setActivePage('tools');
    setSelectedCategoryId(categoryId);
    setSelectedModuleId(moduleId);
    recordModuleUsage(categoryId, moduleId);
  };

  const handleGlobalSearchSelect = useCallback((categoryId: string, moduleId: string) => {
    setActivePage('tools');
    setSelectedCategoryId(categoryId);
    setSelectedModuleId(moduleId);
    recordModuleUsage(categoryId, moduleId);
  }, []);

  const marketplacePlugins = useMemo(
    () => marketplaceInstalled.filter((p) => p.enabled).map((p) => ({ id: p.id, entryUrl: p.entryUrl })),
    [marketplaceInstalled],
  );

  const navItems = useMemo(
    () => [
      { id: 'dashboard', label: t('nav.dashboard'), icon: <VscHome /> },
      ...categories.map((c) => ({ id: c.id, label: c.name, icon: c.icon })),
    ],
    [categories, t],
  );

  const navRightItems = useMemo(
    () => [{ id: 'plugins', label: t('nav.modules'), icon: <VscAdd /> }],
    [t],
  );

  const activeNavId = activePage === 'dashboard' ? 'dashboard' : selectedCategoryId;

  return (
    <div className={styles.app}>
      <TopNav
        items={navItems}
        activeId={activeNavId}
        onSelect={(id) => {
          if (id === 'dashboard') {
            setActivePage('dashboard');
            setSelectedModuleId(null);
            return;
          }
          handleCategorySelect(id);
        }}
        rightItems={navRightItems}
        onSelectRight={(id) => {
          if (id === 'plugins') {
            setShowPluginManager(true);
          }
        }}
      />
      <div className={styles.body}>
        <div className={styles.main}>
          <div className={styles.content}>
            <ContentArea
              selectedModule={activePage === 'tools' ? selectedModule : null}
              categoryId={activePage === 'tools' ? selectedCategoryId : undefined}
              categoryModules={activePage === 'tools' ? modules : undefined}
              showDashboard={activePage === 'dashboard'}
              dashboardCategories={categories}
              onModuleSelect={handleDashboardModuleSelect}
              onOpenGlobalSearch={() => setShowGlobalSearch(true)}
              marketplacePlugins={marketplacePlugins}
            />
          </div>
        </div>
      </div>

      {showPluginManager && (
        <HelpModal title="Modules" onClose={() => setShowPluginManager(false)}>
          <PluginManager onUpdated={handleMarketplaceUpdated} />
        </HelpModal>
      )}

      {showSettings && (
        <HelpModal title="Settings" size="sm" onClose={() => setShowSettings(false)}>
          <SettingsPage showTitle={false} />
        </HelpModal>
      )}

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
      <AppContent />
    </I18nProvider>
  );
}
