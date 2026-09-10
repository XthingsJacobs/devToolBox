import { useEffect, useMemo, useState } from 'react';
import styles from './SettingsPage.module.css';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { APP_VERSION } from '../../appVersion';
import {
  ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL,
  DEFAULT_MARKETPLACE_REGISTRY_URL,
  loadMarketplaceRegistryUrl,
  saveMarketplaceRegistryUrl,
} from '../../marketplace/registry';
import {
  VscDebug,
  VscFolderOpened,
  VscGithub,
  VscGlobe,
  VscInfo,
  VscLock,
  VscMail,
  VscSettingsGear,
  VscSparkle,
  VscSync,
  VscTrash,
} from 'react-icons/vsc';

type SectionId =
  | 'general'
  | 'data'
  | 'import'
  | 'privacy'
  | 'updates'
  | 'about';

const NAV = [
  { id: 'general' as const, label: 'General', Icon: VscSettingsGear, group: 'App' },
  { id: 'data' as const, label: 'Data & Cache', Icon: VscFolderOpened, group: 'System' },
  { id: 'import' as const, label: 'Import / Export', Icon: VscDebug, group: 'System' },
  { id: 'privacy' as const, label: 'Privacy', Icon: VscLock, group: 'System' },
  { id: 'updates' as const, label: 'Updates', Icon: VscSync, group: 'System' },
  { id: 'about' as const, label: 'About', Icon: VscInfo, group: 'About' },
];

const GROUPS = ['App', 'System', 'About'] as const;

export default function SettingsPage() {
  const { setting: themeSetting, setThemeSetting } = useTheme();
  const { setting: localeSetting, setLocale } = useI18n();
  const [active, setActive] = useState<SectionId>('general');
  const [versionText, setVersionText] = useState(`v${APP_VERSION}`);
  const [appInfo, setAppInfo] = useState<{ company?: string; version?: string; build?: string } | null>(null);
  const [iconSmallUrl, setIconSmallUrl] = useState<string | null>(null);
  const [iconLargeUrl, setIconLargeUrl] = useState<string | null>(null);
  const [registryUrl, setRegistryUrl] = useState('');
  const [autoCheckUpdates, setAutoCheckUpdates] = useState(false);
  const [cacheBytes, setCacheBytes] = useState<number | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getAppInfo) return;
    void api.getAppInfo().then((v) => {
      const r = v as { version?: unknown; build?: unknown; company?: unknown };
      const ver = typeof r?.version === 'string' ? r.version : '';
      if (ver) setVersionText(`v${ver}`);
      setAppInfo({
        company: typeof r?.company === 'string' ? r.company : undefined,
        version: ver || undefined,
        build: typeof r?.build === 'string' ? r.build : undefined,
      });
    });
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getAppIcon) return;
    void api.getAppIcon('normal').then((v) => setIconSmallUrl(typeof v === 'string' ? v : null)).catch(() => undefined);
    void api.getAppIcon('large').then((v) => setIconLargeUrl(typeof v === 'string' ? v : null)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL) return;
    setRegistryUrl(loadMarketplaceRegistryUrl());
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getUpdateSettings) return;
    void api
      .getUpdateSettings()
      .then((res) => {
        const r = res as { autoCheck?: unknown };
        setAutoCheckUpdates(Boolean(r?.autoCheck));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (active !== 'data') return;
    const api = window.electronAPI;
    if (!api?.getStorageInfo) return;
    void api
      .getStorageInfo()
      .then((res) => {
        const r = res as { cacheBytes?: unknown };
        const b = typeof r?.cacheBytes === 'number' ? r.cacheBytes : 0;
        setCacheBytes(Number.isFinite(b) && b >= 0 ? b : 0);
      })
      .catch(() => undefined);
  }, [active]);

  const resetAllSettings = async () => {
    const api = window.electronAPI;
    if (!api?.resetAllSettings) return;
    const res = (await api.resetAllSettings()) as { success?: unknown; canceled?: unknown };
    if (res?.canceled) return;
    if (!res?.success) return;
    if (ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL) setRegistryUrl(loadMarketplaceRegistryUrl());
    void api.getUpdateSettings?.().then((r) => {
      const s = r as { autoCheck?: unknown };
      setAutoCheckUpdates(Boolean(s?.autoCheck));
    });
  };

  const deleteAllData = async () => {
    const api = window.electronAPI;
    if (!api?.deleteAllData) return;
    await api.deleteAllData();
  };

  const activeNav = useMemo(() => NAV.find((n) => n.id === active), [active]);

  return (
    <div className={styles.page}>
      <aside className={styles.nav}>
        <div className={styles.navHeader}>
          <div className={styles.navTitle}>Settings</div>
          <div className={styles.navSub}>{versionText}</div>
        </div>

        {GROUPS.map((group) => {
          const items = NAV.filter((n) => n.group === group);
          return (
            <div key={group} className={styles.navGroup}>
              <div className={styles.navGroupTitle}>{group}</div>
              <div className={styles.navList}>
                {items.map((item) => {
                  const isActive = item.id === active;
                  const Icon = item.Icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.navItem}
                      data-active={isActive ? '1' : '0'}
                      onClick={() => setActive(item.id)}
                    >
                      {isActive && <span className={styles.navIndicator} />}
                      <Icon className={styles.navIcon} />
                      <span className={styles.navLabel}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </aside>

      <main className={styles.content}>
        <div className={styles.inner}>
          {active !== 'about' && (
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                {activeNav && (
                  <div className={styles.headerIcon}>
                    <activeNav.Icon />
                  </div>
                )}
                <div>
                  <div className={styles.headerTitle}>{activeNav?.label}</div>
                  <div className={styles.headerSub}>{desc(active)}</div>
                </div>
              </div>
            </div>
          )}

          {active === 'general' && (
            <div className={styles.stack}>
              <Card title="Application" subtitle="Core behavior and startup options">
                <Row label="Auto-check for updates" desc="Check on startup and once per hour in the background">
                  <Toggle
                    value={autoCheckUpdates}
                    onChange={(next) => {
                      setAutoCheckUpdates(next);
                      void window.electronAPI?.setAutoUpdateCheck?.(next);
                    }}
                  />
                </Row>
              </Card>

              <Card title="Theme" subtitle="Choose your interface color scheme">
                <div className={styles.themeRow}>
                  {[
                    { id: 'auto' as const, label: 'Auto' },
                    { id: 'dark' as const, label: 'Dark' },
                    { id: 'light' as const, label: 'Light' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={styles.themeCard}
                      data-active={themeSetting === t.id ? '1' : '0'}
                      onClick={() => setThemeSetting(t.id)}
                    >
                      <div
                        className={styles.themePreview}
                        data-theme={t.id}
                        style={{ height: 46, borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                      >
                        <ThemePreviewSvg mode={t.id} />
                      </div>
                      <div className={styles.themeLabel}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="Interface Language" subtitle="Set the display language for DevToolBox UI">
                <div className={styles.langList}>
                  {[
                    { id: 'auto' as const, label: 'Auto (Follow System)', sub: 'Uses your OS language setting' },
                    { id: 'en' as const, label: 'English', sub: 'English' },
                    { id: 'zh-CN' as const, label: 'Simplified Chinese', sub: '简体中文' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={styles.langItem}
                      data-active={localeSetting === l.id ? '1' : '0'}
                      onClick={() => setLocale(l.id)}
                    >
                      <span className={styles.radio} data-active={localeSetting === l.id ? '1' : '0'}>
                        <span className={styles.radioDot} data-active={localeSetting === l.id ? '1' : '0'} />
                      </span>
                      <span className={styles.langText}>
                        <span className={styles.langLabel}>{l.label}</span>
                        <span className={styles.langSub}>{l.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className={styles.notice}>A restart may be required for language changes to fully take effect.</div>
              </Card>
            </div>
          )}

          {active === 'data' && (
            <div className={styles.stack}>
              <Card title="Storage" subtitle="Manage application data and cache">
                <Row label="Cache size" desc="Temporary data and compiled tool outputs">
                  <div className={styles.cacheRow}>
                    <span className={styles.cachePill}>{cacheBytes === null ? '-' : formatBytes(cacheBytes)}</span>
                    <button
                      type="button"
                      className={styles.smallBtn}
                      disabled={clearingCache}
                      onClick={async () => {
                        const api = window.electronAPI;
                        if (!api?.clearStorage) return;
                        if (clearingCache) return;
                        setClearingCache(true);
                        try {
                          const res = (await api.clearStorage()) as {
                            success?: unknown;
                            canceled?: unknown;
                            cacheBytes?: unknown;
                          };
                          if (res?.canceled) return;
                          if (res?.success) {
                            const b = typeof res?.cacheBytes === 'number' ? res.cacheBytes : 0;
                            setCacheBytes(Number.isFinite(b) && b >= 0 ? b : 0);
                          }
                        } finally {
                          setClearingCache(false);
                        }
                      }}
                    >
                      <VscTrash />
                      {clearingCache ? 'Clearing…' : 'Clear'}
                    </button>
                  </div>
                </Row>
              </Card>

              {ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL && (
                <Card title="Marketplace (Dev)" subtitle="Override registry source for local plugin development">
                  <Row label="Registry URL" desc="Empty value uses the default registry">
                    <div className={styles.registryRow}>
                      <input
                        className={styles.input}
                        value={registryUrl}
                        placeholder={DEFAULT_MARKETPLACE_REGISTRY_URL}
                        onChange={(e) => setRegistryUrl(e.target.value)}
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
                  </Row>
                  <div className={styles.notice}>Supports http(s) URLs and file:// URLs (dev only).</div>
                </Card>
              )}

              <DangerCard onResetAllSettings={resetAllSettings} onDeleteAllData={deleteAllData} />
            </div>
          )}

          {active === 'about' && (
            <AboutPanel
              title={appInfo?.version ? 'DevToolBox' : 'DevToolBox'}
              versionText={
                appInfo?.version && appInfo?.build ? `Version ${appInfo.version} (Build ${appInfo.build})` : `Version ${versionText.startsWith('v') ? versionText.slice(1) : versionText}`
              }
              iconSmallUrl={iconSmallUrl}
              iconLargeUrl={iconLargeUrl}
            />
          )}

          {!['general', 'data', 'about'].includes(active) && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <VscLock />
              </div>
              <div className={styles.emptyTitle}>{activeNav?.label} Settings</div>
              <div className={styles.emptySub}>This section is under construction</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function desc(id: SectionId) {
  const map: Record<SectionId, string> = {
    general: 'App behavior, theme and language preferences',
    data: 'Cache management, storage and history',
    import: 'Import and export your DevToolBox configuration',
    privacy: 'Telemetry, crash reporting and data sharing',
    updates: 'Auto-update channel and release preferences',
    about: 'Version info, license and credits',
  };
  return map[id];
}

function formatBytes(bytes: number): string {
  const b = Number.isFinite(bytes) && bytes >= 0 ? bytes : 0;
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <div className={styles.cardTitle}>{title}</div>
          <div className={styles.cardSub}>{subtitle}</div>
        </div>
      </div>
      <div className={styles.cardBody}>{children}</div>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      <div className={styles.rowRight}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={styles.toggle}
      data-on={value ? '1' : '0'}
      onClick={() => onChange(!value)}
      aria-label="Toggle"
    >
      <span className={styles.toggleDot} data-on={value ? '1' : '0'} />
    </button>
  );
}

function ThemePreviewSvg({ mode }: { mode: 'auto' | 'dark' | 'light' }) {
  const left = mode === 'auto' ? 0 : null;
  const topL = mode === 'light' ? '#f0f3f6' : '#161b22';
  const sideL = mode === 'light' ? '#e4e9ed' : '#21262d';
  const mainL = mode === 'light' ? '#fafbfc' : '#0d1117';
  const topR = '#f0f3f6';
  const sideR = '#e4e9ed';
  const mainR = '#fafbfc';
  const top = mode === 'auto' ? 'url(#tpTop)' : topL;
  const side = mode === 'auto' ? 'url(#tpSide)' : sideL;
  const main = mode === 'auto' ? 'url(#tpMain)' : mainL;

  return (
    <svg viewBox="0 0 100 46" style={{ width: '100%', height: '100%', display: 'block' }} preserveAspectRatio="none">
      {left !== null && (
        <defs>
          <linearGradient id="tpTop" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#161b22" />
            <stop offset="0.5" stopColor="#161b22" />
            <stop offset="0.5" stopColor={topR} />
            <stop offset="1" stopColor={topR} />
          </linearGradient>
          <linearGradient id="tpSide" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#21262d" />
            <stop offset="0.5" stopColor="#21262d" />
            <stop offset="0.5" stopColor={sideR} />
            <stop offset="1" stopColor={sideR} />
          </linearGradient>
          <linearGradient id="tpMain" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0d1117" />
            <stop offset="0.5" stopColor="#0d1117" />
            <stop offset="0.5" stopColor={mainR} />
            <stop offset="1" stopColor={mainR} />
          </linearGradient>
        </defs>
      )}

      <rect x="0" y="0" width="100" height="14" fill={top} />
      <rect x="0" y="14" width="28" height="32" fill={side} />
      <rect x="28" y="14" width="72" height="32" fill={main} />
    </svg>
  );
}

function AboutPanel({
  title,
  versionText,
  iconSmallUrl,
  iconLargeUrl,
}: {
  title: string;
  versionText: string;
  iconSmallUrl: string | null;
  iconLargeUrl: string | null;
}) {
  return (
    <div className={styles.aboutPanel}>
      <div className={styles.aboutHeaderRow}>
        <div className={styles.aboutHeaderLeft}>
          <div className={styles.aboutHeaderBadge}>
            {iconSmallUrl ? <img className={styles.aboutAppIconSmall} src={iconSmallUrl} alt="" /> : <VscSparkle size={16} />}
          </div>
          <div className={styles.aboutHeaderTitle}>About {title}</div>
        </div>
      </div>

      <div className={styles.aboutContent}>
        <div className={styles.aboutHero2}>
          <div className={styles.aboutHeroIcon}>
            {iconLargeUrl ? <img className={styles.aboutAppIconLarge} src={iconLargeUrl} alt="" /> : <VscSparkle size={36} />}
          </div>
          <div className={styles.aboutHeroTitle}>{title}</div>
          <div className={styles.aboutHeroSub}>Developer Productivity Suite</div>
          <div className={styles.aboutHeroMeta}>{versionText}</div>
        </div>

        <div className={styles.aboutDesc2}>
          A comprehensive collection of developer tools designed to streamline your workflow. From encoding/decoding utilities to text formatting and network diagnostics.
        </div>

        <div className={styles.aboutGrid}>
          <InfoItem label="License" value="MIT License" />
          <InfoItem label="Platform" value="Cross-platform" />
          <InfoItem label="Framework" value="React + TypeScript" />
          <InfoItem label="Last Updated" value={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
        </div>

        <div className={styles.aboutLinks}>
          <LinkButton icon={<VscGithub size={14} />} label="View on GitHub" href="https://github.com/devtoolbox" />
          <LinkButton icon={<VscGlobe size={14} />} label="Official Website" href="https://devtoolbox.dev" />
          <LinkButton icon={<VscMail size={14} />} label="Contact Support" href="mailto:support@devtoolbox.dev" />
        </div>
      </div>

      <div className={styles.aboutFooter}>
        <div className={styles.aboutFooterText}>© {new Date().getFullYear()} {title}. All rights reserved.</div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.aboutInfoItem}>
      <div className={styles.aboutInfoLabel}>{label}</div>
      <div className={styles.aboutInfoValue}>{value}</div>
    </div>
  );
}

function LinkButton({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a className={styles.aboutLinkBtn} href={href} target="_blank" rel="noopener noreferrer">
      <span className={styles.aboutLinkIcon}>{icon}</span>
      <span>{label}</span>
    </a>
  );
}

function DangerCard({
  onResetAllSettings,
  onDeleteAllData,
}: {
  onResetAllSettings: () => Promise<void>;
  onDeleteAllData: () => Promise<void>;
}) {
  const [busyReset, setBusyReset] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  const reset = async () => {
    if (busyReset) return;
    setBusyReset(true);
    try {
      await onResetAllSettings();
    } finally {
      setBusyReset(false);
    }
  };

  const del = async () => {
    if (busyDelete) return;
    setBusyDelete(true);
    try {
      await onDeleteAllData();
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div className={styles.danger}>
      <div className={styles.dangerHead}>
        <VscTrash className={styles.dangerIcon} />
        <div>
          <div className={styles.dangerTitle}>Danger Zone</div>
          <div className={styles.dangerSub}>Irreversible actions — proceed with caution</div>
        </div>
      </div>
      <div className={styles.dangerBody}>
        <div className={styles.dangerRow} data-divider="0">
          <div>
            <div className={styles.dangerRowLabel}>Reset All Settings</div>
            <div className={styles.dangerRowDesc}>Restore theme, language and update preferences to defaults</div>
          </div>
          <button type="button" className={styles.dangerBtn} disabled={busyReset} onClick={reset}>
            <VscTrash />
            {busyReset ? 'Resetting…' : 'Reset'}
          </button>
        </div>

        <div className={styles.dangerRow} data-divider="1">
          <div>
            <div className={styles.dangerRowLabel}>Delete All Data</div>
            <div className={styles.dangerRowDesc}>Permanently delete all local app data (including plugins)</div>
          </div>
          <button type="button" className={styles.dangerBtn} disabled={busyDelete} onClick={del}>
            <VscTrash />
            {busyDelete ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
