import type { Dispatch, SetStateAction } from 'react';
import { DEFAULT_MARKETPLACE_REGISTRY_URL, saveMarketplaceRegistryUrl } from '../../marketplace/registry';
import styles from './SettingsPage.module.css';
import { SettingsCard } from './SettingsCard';

export function MarketplaceRegistrySection({
  registryUrl,
  setRegistryUrl,
}: {
  registryUrl: string;
  setRegistryUrl: Dispatch<SetStateAction<string>>;
}) {
  return (
    <div className={styles.stack}>
      <SettingsCard
        title="Marketplace Registry"
        subtitle="Override the registry source for local plugin development"
      >
        <div className={styles.formField}>
          <div className={styles.fieldHeader}>
            <label className={styles.fieldLabel} htmlFor="marketplace-registry-url">
              Registry URL
            </label>
            <div className={styles.fieldDescription} id="marketplace-registry-description">
              Empty value uses the default registry
            </div>
          </div>
          <div className={styles.registryRow}>
            <input
              id="marketplace-registry-url"
              className={styles.input}
              value={registryUrl}
              placeholder={DEFAULT_MARKETPLACE_REGISTRY_URL}
              aria-describedby="marketplace-registry-description"
              onChange={(event) => setRegistryUrl(event.target.value)}
            />
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => {
                saveMarketplaceRegistryUrl(registryUrl);
                window.dispatchEvent(new Event('devtoolbox:registryUrlChanged'));
              }}
            >
              Apply
            </button>
          </div>
        </div>
        <div className={styles.notice}>Supports HTTPS and file:// URLs in development builds.</div>
      </SettingsCard>
    </div>
  );
}
