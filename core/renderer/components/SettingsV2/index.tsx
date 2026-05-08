import { useEffect, useMemo, useState } from 'react';
import styles from './SettingsV2.module.css';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import {
  VscColorMode,
  VscDebug,
  VscFolderOpened,
  VscGlobe,
  VscInfo,
  VscKeyboardTab,
  VscLock,
  VscSettingsGear,
  VscSync,
  VscTrash,
} from 'react-icons/vsc';

type SectionId =
  | 'general'
  | 'appearance'
  | 'language'
  | 'shortcuts'
  | 'data'
  | 'import'
  | 'privacy'
  | 'updates'
  | 'about';

const NAV = [
  { id: 'general' as const, label: 'General', Icon: VscSettingsGear, group: 'App' },
  { id: 'appearance' as const, label: 'Appearance', Icon: VscColorMode, group: 'App' },
  { id: 'language' as const, label: 'Language', Icon: VscGlobe, group: 'App' },
  { id: 'shortcuts' as const, label: 'Shortcuts', Icon: VscKeyboardTab, group: 'App' },
  { id: 'data' as const, label: 'Data & Cache', Icon: VscFolderOpened, group: 'System' },
  { id: 'import' as const, label: 'Import / Export', Icon: VscDebug, group: 'System' },
  { id: 'privacy' as const, label: 'Privacy', Icon: VscLock, group: 'System' },
  { id: 'updates' as const, label: 'Updates', Icon: VscSync, group: 'System' },
  { id: 'about' as const, label: 'About', Icon: VscInfo, group: 'About' },
];

const GROUPS = ['App', 'System', 'About'] as const;

export default function SettingsV2() {
  const { setting: themeSetting, setThemeSetting } = useTheme();
  const { setting: localeSetting, setLocale } = useI18n();
  const [active, setActive] = useState<SectionId>('general');
  const [saved, setSaved] = useState(false);
  const [versionText, setVersionText] = useState('v2.0.0');

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getAppInfo) return;
    void api.getAppInfo().then((v) => {
      const r = v as { version?: unknown };
      const ver = typeof r?.version === 'string' ? r.version : '';
      if (ver) setVersionText(`v${ver}`);
    });
  }, []);

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
            <button
              type="button"
              className={styles.saveBtn}
              data-saved={saved ? '1' : '0'}
              onClick={() => {
                setSaved(true);
                window.setTimeout(() => setSaved(false), 1800);
              }}
            >
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>

          {active === 'general' && (
            <div className={styles.stack}>
              <Card title="Application" subtitle="Core behavior and startup options">
                <Row label="Auto-check for updates" desc="Automatically check for new versions on startup">
                  <Toggle value />
                </Row>
                <Divider />
                <Row label="Send usage statistics" desc="Help improve DevToolBox with anonymous usage data">
                  <Toggle />
                </Row>
                <Divider />
                <Row label="Desktop notifications" desc="Show notifications for completed operations">
                  <Toggle value />
                </Row>
              </Card>

              <Card title="Editor" subtitle="Monospace editor preferences">
                <Row label="Font size" desc="Monospace editor font size">
                  <Select value="13" options={['11', '12', '13', '14', '16', '18']} onChange={() => {}} />
                </Row>
                <Divider />
                <Row label="Word wrap" desc="Wrap long lines in the editor">
                  <Toggle value />
                </Row>
                <Divider />
                <Row label="Tab size" desc="Number of spaces per indent level">
                  <Select value="2" options={['2', '4', '8']} onChange={() => {}} />
                </Row>
              </Card>
            </div>
          )}

          {active === 'appearance' && (
            <div className={styles.stack}>
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
                      <div className={styles.themePreview} data-theme={t.id} />
                      <div className={styles.themeLabel}>{t.label}</div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="Density" subtitle="Adjust interface information density">
                <div className={styles.densityRow}>
                  {['Compact', 'Comfortable', 'Spacious'].map((d) => (
                    <button key={d} type="button" className={styles.densityBtn} data-active={d === 'Comfortable' ? '1' : '0'}>
                      {d}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {active === 'language' && (
            <div className={styles.stack}>
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
                    <span className={styles.cachePill}>148 MB</span>
                    <button type="button" className={styles.smallBtn}>
                      <VscTrash />
                      Clear
                    </button>
                  </div>
                </Row>
              </Card>
              <DangerCard />
            </div>
          )}

          {active === 'about' && (
            <div className={styles.stack}>
              <Card title="DevToolBox" subtitle="Developer productivity utilities hub">
                <div className={styles.aboutHero}>
                  <div className={styles.aboutLogo}>⚙️</div>
                  <div>
                    <div className={styles.aboutName}>DevToolBox</div>
                    <div className={styles.aboutMeta}>
                      {`Version ${versionText.startsWith('v') ? versionText.slice(1) : versionText}`}
                    </div>
                  </div>
                </div>
                <div className={styles.kv}>
                  {[
                    ['License', 'Apache-2.0'],
                    ['Runtime', 'Electron + React'],
                    ['Platform', 'macOS / Windows'],
                  ].map(([k, v]) => (
                    <div key={k} className={styles.kvRow}>
                      <span className={styles.kvKey}>{k}</span>
                      <span className={styles.kvVal}>{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {!['general', 'appearance', 'language', 'data', 'about'].includes(active) && (
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
    general: 'App behavior, editor preferences and startup options',
    appearance: 'Theme, density and visual customizations',
    language: 'Interface display language and locale',
    shortcuts: 'Custom keyboard shortcut bindings',
    data: 'Cache management, storage and history',
    import: 'Import and export your DevToolBox configuration',
    privacy: 'Telemetry, crash reporting and data sharing',
    updates: 'Auto-update channel and release preferences',
    about: 'Version info, license and credits',
  };
  return map[id];
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

function Divider() {
  return <div className={styles.divider} />;
}

function Toggle({ value = false }: { value?: boolean }) {
  const [on, setOn] = useState(value);
  return (
    <button type="button" className={styles.toggle} data-on={on ? '1' : '0'} onClick={() => setOn((v) => !v)} aria-label="Toggle">
      <span className={styles.toggleDot} data-on={on ? '1' : '0'} />
    </button>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function DangerCard() {
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
        {[
          { label: 'Reset All Settings', desc: 'Restore all settings to factory defaults' },
          { label: 'Delete All Data', desc: 'Permanently delete all local app data and history' },
        ].map((x, idx) => (
          <div key={x.label} className={styles.dangerRow} data-divider={idx > 0 ? '1' : '0'}>
            <div>
              <div className={styles.dangerRowLabel}>{x.label}</div>
              <div className={styles.dangerRowDesc}>{x.desc}</div>
            </div>
            <button type="button" className={styles.dangerBtn}>
              <VscTrash />
              {x.label.startsWith('Delete') ? 'Delete' : 'Reset'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
