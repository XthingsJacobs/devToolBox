import styles from './ModulesPage.module.css';
import type { InstalledMarketplacePlugin } from '../../marketplace/types';
import { useI18n } from '../../i18n';
import { InstalledModuleCard } from './InstalledModuleCard';
import { MarketplaceModuleCard } from './MarketplaceModuleCard';
import { ModuleCenterHeader } from './ModuleCenterHeader';
import { ModuleFilters } from './ModuleFilters';
import { ModuleUpgradeBanner } from './ModuleUpgradeBanner';
import { hasPluginUpdate } from './ModulesPage.model';
import { useModulesController } from './useModulesController';

export default function ModulesPage({
  onUpdated,
}: {
  onUpdated?: (installed: InstalledMarketplacePlugin[]) => void;
}) {
  const { locale } = useI18n();
  const modules = useModulesController({ locale, onUpdated });

  return (
    <div className={styles.page}>
      <ModuleCenterHeader
        installedCount={modules.installed.length}
        availableCount={modules.marketplaceLatest.length}
        updateCount={modules.upgradeEntries.length}
        refreshing={modules.refreshing}
        onRefresh={() => void modules.refreshAll({ force: true })}
      />

      <ModuleFilters
        activeTab={modules.activeTab}
        setActiveTab={modules.setActiveTab}
        installedCount={modules.installed.length}
        marketplaceCount={modules.marketplaceLatest.length}
        localOnly={modules.localOnly}
        setLocalOnly={modules.setLocalOnly}
        categories={modules.cats}
        filterCat={modules.filterCat}
        setFilterCat={modules.setFilterCat}
        query={modules.query}
        setQuery={modules.setQuery}
      />

      <div className={styles.list}>
        {modules.activeTab === 'installed' && (
          <>
            <ModuleUpgradeBanner
              updateCount={modules.upgradeEntries.length}
              onUpgradeAll={() => void modules.handleUpgradeAll()}
            />

            <div className={styles.cards}>
              {modules.filteredInstalled.map((plugin) => {
                const latest = modules.registryLatestMap.get(plugin.id);
                return (
                  <InstalledModuleCard
                    key={plugin.id}
                    plugin={plugin}
                    latest={latest}
                    hasUpdate={hasPluginUpdate(plugin.version, latest)}
                    installingId={modules.installingId}
                    locale={locale}
                    onInstall={(entry) => void modules.handleInstall(entry)}
                    onToggle={(id, enabled) => void modules.handleToggle(id, enabled)}
                    onUninstall={(id) => void modules.handleUninstall(id)}
                  />
                );
              })}

              {modules.filteredInstalled.length === 0 && (
                <div className={styles.empty}>No installed modules</div>
              )}
            </div>
          </>
        )}

        {modules.activeTab === 'marketplace' && (
          <div className={styles.cards}>
            {modules.filteredMarketplace.map((entry) => {
              const installedPlugin = modules.installedMap.get(entry.manifest.id);
              return (
                <MarketplaceModuleCard
                  key={entry.manifest.id}
                  entry={entry}
                  installedPlugin={installedPlugin}
                  hasUpdate={hasPluginUpdate(installedPlugin?.version, entry)}
                  installingId={modules.installingId}
                  locale={locale}
                  onInstall={(nextEntry) => void modules.handleInstall(nextEntry)}
                />
              );
            })}
            {modules.filteredMarketplace.length === 0 && (
              <div className={styles.empty}>Marketplace registry is empty</div>
            )}
          </div>
        )}

        {modules.error && <div className={styles.error}>{modules.error}</div>}
      </div>
    </div>
  );
}
