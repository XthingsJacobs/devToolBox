import { useRef } from 'react';
import type { Category, Module } from '../../types';
import styles from './ContentArea.module.css';
import { moduleComponentMap } from '../../data/placeholder';
import Dashboard from '../Dashboard';
import { useI18n } from '../../i18n';
import PluginHost from '../PluginHost';
import CategoryGallery from '../CategoryGallery';

interface ContentAreaProps {
  selectedModule: Module | null;
  categoryId?: string;
  categoryModules?: Module[];
  showDashboard?: boolean;
  dashboardCategories?: Category[];
  onModuleSelect: (categoryId: string, moduleId: string) => void;
  onOpenGlobalSearch?: () => void;
  marketplacePlugins?: { id: string; entryUrl: string }[];
}

export default function ContentArea({
  selectedModule,
  categoryId,
  categoryModules,
  showDashboard = false,
  dashboardCategories,
  onModuleSelect,
  onOpenGlobalSearch,
  marketplacePlugins = [],
}: ContentAreaProps) {
  const { t } = useI18n();
  const mountedRef = useRef(new Set<string>());
  const marketplaceMountedRef = useRef(new Set<string>());
  const marketplaceEntryMap = new Map(marketplacePlugins.map((p) => [p.id, p.entryUrl]));

  const shouldShowDashboard = showDashboard && !selectedModule;

  // Track visited modules
  if (selectedModule) {
    mountedRef.current.add(selectedModule.id);
    if (marketplaceEntryMap.has(selectedModule.id)) marketplaceMountedRef.current.add(selectedModule.id);
  }

  return (
    <>
      {/* Dashboard: shown when no module is selected */}
      {shouldShowDashboard && (
        <div className={styles.keepAlive}>
          <Dashboard
            categories={dashboardCategories}
            onModuleSelect={onModuleSelect}
            onOpenGlobalSearch={onOpenGlobalSearch}
          />
        </div>
      )}

      {!selectedModule && !shouldShowDashboard && categoryModules && (
        <div className={styles.keepAlive}>
          <CategoryGallery
            categoryId={categoryId}
            modules={categoryModules}
            onSelect={(moduleId) => onModuleSelect(categoryId ?? '', moduleId)}
          />
        </div>
      )}

      {/* Keep previously visited static modules mounted; hide inactive ones */}
      {Array.from(mountedRef.current).map((moduleId) => {
        const Component = moduleComponentMap.get(moduleId);
        if (!Component) return null;
        const isActive = selectedModule?.id === moduleId;
        return (
          <div key={moduleId} className={styles.keepAlive} style={{ display: isActive ? undefined : 'none' }}>
            <Component />
          </div>
        );
      })}

      {/* Keep previously visited marketplace plugins mounted */}
      {Array.from(marketplaceMountedRef.current).map((pluginId) => {
        const entryUrl = marketplaceEntryMap.get(pluginId);
        if (!entryUrl) return null;
        const isActive = selectedModule?.id === pluginId;
        return (
          <div key={pluginId} className={styles.keepAlive} style={{ display: isActive ? undefined : 'none' }}>
            <PluginHost pluginId={pluginId} entryUrl={entryUrl} />
          </div>
        );
      })}

      {/* Fallback for non-MQTT modules without a registered component */}
      {selectedModule &&
        !moduleComponentMap.has(selectedModule.id) &&
        !marketplaceEntryMap.has(selectedModule.id) && (
          <main className={styles.area} aria-label={t('dashboard.contentArea')}>
            <h2 className={styles.title}>{selectedModule.name}</h2>
            <p className={styles.description}>{selectedModule.description}</p>
          </main>
        )}
    </>
  );
}
