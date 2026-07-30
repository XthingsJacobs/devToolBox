import { VscArrowUp, VscCheck } from 'react-icons/vsc';
import type { InstalledMarketplacePlugin, MarketplaceRegistryEntry } from '../../marketplace/types';
import { marketplacePluginIconFromManifest } from '../../marketplace/icons';
import { getMarketplaceManifestText } from '../../marketplace/i18n';
import type { Locale } from '@devtoolbox/core';
import styles from './ModulesPage.module.css';
import { isLocalMarketplaceEntry, marketplaceModuleCategoryColor, metadataList } from './ModulesPage.model';

export function MarketplaceModuleCard({
  entry,
  installedPlugin,
  hasUpdate,
  installingId,
  locale,
  onInstall,
}: {
  entry: MarketplaceRegistryEntry;
  installedPlugin?: InstalledMarketplacePlugin;
  hasUpdate: boolean;
  installingId: string | null;
  locale: Locale;
  onInstall: (entry: MarketplaceRegistryEntry) => void;
}) {
  const id = entry.manifest.id;
  const color = marketplaceModuleCategoryColor(entry.manifest.categoryId);
  const text = getMarketplaceManifestText(entry.manifest, locale);

  return (
    <div className={styles.card}>
      <div className={styles.cardIcon} style={{ color, background: `${color}12`, borderColor: `${color}22` }}>
        {marketplacePluginIconFromManifest(entry.manifest)}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <div className={styles.cardName}>{text.name}</div>
          {entry.manifest.version ? <span className={styles.pill}>v{entry.manifest.version}</span> : null}
          {isLocalMarketplaceEntry(entry) ? <span className={styles.localBadge}>Local</span> : null}
          <span className={styles.pillCat} style={{ color, background: `${color}12` }}>
            {entry.manifest.categoryId}
          </span>
          {installedPlugin && (
            <span className={styles.pillOk}>
              <VscCheck /> Installed
            </span>
          )}
        </div>
        <div className={styles.cardDesc}>{text.description}</div>
        <div className={styles.metadataGrid}>
          <span className={styles.metadataItem}>ID {entry.manifest.id}</span>
          <span className={styles.metadataItem}>Permissions {metadataList(entry.manifest.permissions)}</span>
          <span className={styles.metadataItem}>Domains {metadataList(entry.manifest.httpDomains)}</span>
          <span className={styles.metadataItem}>
            Source {isLocalMarketplaceEntry(entry) ? 'local ZIP' : 'registry package'}
          </span>
        </div>
        {entry.manifest.author ? <div className={styles.cardMeta}>by {entry.manifest.author}</div> : null}
      </div>

      <div className={styles.actions}>
        {installedPlugin ? (
          hasUpdate ? (
            <button
              type="button"
              className={styles.actionBtn}
              data-variant="primary"
              disabled={installingId === id}
              onClick={() => onInstall(entry)}
            >
              <VscArrowUp />
              Upgrade
            </button>
          ) : (
            <span className={styles.pillOk}>
              <VscCheck /> Installed
            </span>
          )
        ) : (
          <button
            type="button"
            className={styles.actionBtn}
            data-variant="primary"
            disabled={installingId === id}
            onClick={() => onInstall(entry)}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
