import { useEffect, useState } from 'react';
import styles from './SettingsPage.module.css';
import {
  ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL,
  DEFAULT_MARKETPLACE_REGISTRY_URL,
  loadMarketplaceRegistryUrl,
  saveMarketplaceRegistryUrl,
} from '../../marketplace/registry';

type AppInfo = {
  name: string;
  company: string;
  version: string;
  build: string;
  electron: string;
  chrome: string;
  node: string;
};

export default function SettingsPage({ showTitle = true }: { showTitle?: boolean }) {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [registryUrl, setRegistryUrl] = useState('');

  useEffect(() => {
    const api = window.electronAPI;
    if (api?.getAppInfo) void api.getAppInfo().then(setInfo);
  }, []);

  useEffect(() => {
    if (!ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL) return;
    setRegistryUrl(loadMarketplaceRegistryUrl());
  }, []);

  return (
    <main className={`${styles.wrap}${showTitle ? '' : ` ${styles.compact}`}`} aria-label="Settings">
      {showTitle && <div className={styles.title}>Settings</div>}
      <div className={styles.card}>
        {!info ? (
          <div className={styles.row}>
            <span className={styles.label}>Loading...</span>
          </div>
        ) : (
          <>
            <div className={styles.row}>
              <span className={styles.label}>Name</span>
              <span className={styles.value}>{info.name}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Owner</span>
              <span className={styles.value}>{info.company}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Version</span>
              <span className={styles.value}>{info.version}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Build</span>
              <span className={styles.value}>{info.build}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Electron</span>
              <span className={styles.value}>{info.electron}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Chrome</span>
              <span className={styles.value}>{info.chrome}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Node</span>
              <span className={styles.value}>{info.node}</span>
            </div>
          </>
        )}
      </div>

      {ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL && (
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.label}>Marketplace Registry URL</span>
            <span />
          </div>
          <div className={styles.row}>
            <input
              className={styles.input}
              value={registryUrl}
              placeholder={DEFAULT_MARKETPLACE_REGISTRY_URL}
              onChange={(e) => setRegistryUrl(e.target.value)}
            />
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                saveMarketplaceRegistryUrl(registryUrl);
                window.dispatchEvent(new Event('devtoolbox:registryUrlChanged'));
              }}
            >
              Save
            </button>
          </div>
          <div className={styles.hint}>
            Empty value uses the default Marketplace registry. To override, paste a registry.json URL and click Save.
          </div>
        </div>
      )}
    </main>
  );
}
