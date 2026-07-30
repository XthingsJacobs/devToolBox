import { VscArrowUp, VscTrash, VscVerifiedFilled, VscWarning } from 'react-icons/vsc';
import type { InstalledMarketplacePlugin, MarketplaceRegistryEntry } from '../../marketplace/types';
import { marketplacePluginIconFromManifest } from '../../marketplace/icons';
import { getMarketplaceManifestText } from '../../marketplace/i18n';
import type { Locale } from '@devtoolbox/core';
import styles from './ModulesPage.module.css';
import { marketplaceModuleCategoryColor, metadataList } from './ModulesPage.model';

export function InstalledModuleCard({
  plugin,
  latest,
  hasUpdate,
  installingId,
  locale,
  onInstall,
  onToggle,
  onUninstall,
}: {
  plugin: InstalledMarketplacePlugin;
  latest?: MarketplaceRegistryEntry;
  hasUpdate: boolean;
  installingId: string | null;
  locale: Locale;
  onInstall: (entry: MarketplaceRegistryEntry) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onUninstall: (id: string) => void;
}) {
  const color = marketplaceModuleCategoryColor(plugin.manifest.categoryId);
  const text = getMarketplaceManifestText(plugin.manifest, locale);

  return (
    <div className={styles.card}>
      <div className={styles.cardIcon} style={{ color, background: `${color}12`, borderColor: `${color}22` }}>
        {marketplacePluginIconFromManifest(plugin.manifest)}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <div className={styles.cardName}>{text.name}</div>
          <span className={styles.pill}>v{plugin.version}</span>
          {hasUpdate && latest?.manifest.version ? (
            <span className={`${styles.pill} ${styles.pillUpgrade}`}>v{latest.manifest.version}</span>
          ) : null}
          <span className={styles.pillCat} style={{ color, background: `${color}12` }}>
            {plugin.manifest.categoryId}
          </span>
          <span
            className={styles.provenancePill}
            data-status={plugin.provenance?.status ?? 'legacy'}
            title={
              plugin.provenance?.status === 'verified'
                ? `Verified publisher: ${plugin.provenance.publisher ?? 'unknown'}\nSource: ${plugin.provenance.source?.repository ?? 'unknown'}\nRevision: ${plugin.provenance.source?.revision ?? 'unknown'}`
                : plugin.provenance?.status === 'untrusted'
                  ? `Signature key is not trusted: ${plugin.provenance.publisher ?? 'unknown'}`
                  : plugin.provenance?.status === 'unsigned'
                    ? 'Installed without a package signature while audit mode was active'
                    : 'Installed before provenance tracking was available'
            }
          >
            {plugin.provenance?.status === 'verified' ? <VscVerifiedFilled /> : <VscWarning />}
            {plugin.provenance?.status === 'verified'
              ? `Verified · ${plugin.provenance.publisher ?? 'publisher'}`
              : plugin.provenance?.status === 'untrusted'
                ? 'Untrusted signature'
                : plugin.provenance?.status === 'unsigned'
                  ? 'Unsigned'
                  : 'Legacy install'}
          </span>
          {!plugin.enabled && <span className={styles.pillMuted}>Disabled</span>}
        </div>
        <div className={styles.cardDesc}>{text.description}</div>
        <div className={styles.metadataGrid}>
          <span className={styles.metadataItem}>ID {plugin.manifest.id}</span>
          <span className={styles.metadataItem}>Permissions {metadataList(plugin.manifest.permissions)}</span>
          <span className={styles.metadataItem}>Domains {metadataList(plugin.manifest.httpDomains)}</span>
        </div>
        {plugin.manifest.author ? <div className={styles.cardMeta}>by {plugin.manifest.author}</div> : null}
      </div>

      <div className={styles.actions}>
        {hasUpdate && latest && (
          <button
            type="button"
            className={styles.actionBtn}
            data-variant="upgrade"
            disabled={installingId === plugin.id}
            onClick={() => onInstall(latest)}
          >
            <VscArrowUp />
            Upgrade
          </button>
        )}
        <button
          type="button"
          className={styles.actionBtn}
          data-variant={plugin.enabled ? 'enabled' : 'disabled'}
          onClick={() => onToggle(plugin.id, !plugin.enabled)}
        >
          <span className={styles.togglePill} data-enabled={plugin.enabled ? '1' : '0'}>
            <span className={styles.toggleDot} data-enabled={plugin.enabled ? '1' : '0'} />
          </span>
          {plugin.enabled ? 'Enabled' : 'Disabled'}
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => onUninstall(plugin.id)}
          aria-label="Uninstall"
        >
          <VscTrash />
        </button>
      </div>
    </div>
  );
}
