import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  VscColorMode,
  VscDebugRestart,
  VscExport,
  VscFolderOpened,
  VscGlobe,
  VscInfo,
  VscPulse,
  VscRefresh,
  VscTrash,
} from 'react-icons/vsc';
import type { DiagnosticLog, StartupRestartMode, StartupStatus } from '@devtoolbox/core';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { APP_VERSION } from '../../appVersion';
import {
  ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL,
  DEFAULT_MARKETPLACE_REGISTRY_URL,
  loadMarketplaceRegistryUrl,
  saveMarketplaceRegistryUrl,
} from '../../marketplace/registry';
import { appService, diagnosticsService } from '../../services';
import styles from './SettingsPage.module.css';

export type SectionId = 'appearance' | 'language' | 'data' | 'diagnostics' | 'about';

const NAV = [
  { id: 'appearance' as const, label: 'Appearance', Icon: VscColorMode, group: 'App' },
  { id: 'language' as const, label: 'Language', Icon: VscGlobe, group: 'App' },
  { id: 'data' as const, label: 'Marketplace', Icon: VscFolderOpened, group: 'System', devOnly: true },
  { id: 'diagnostics' as const, label: 'Diagnostics', Icon: VscPulse, group: 'System' },
  { id: 'about' as const, label: 'About', Icon: VscInfo, group: 'About' },
];

const GROUPS = ['App', 'System', 'About'] as const;

export default function SettingsPage({
  initialSection = 'appearance',
  startupStatus,
  onRestart,
}: {
  initialSection?: SectionId;
  startupStatus?: StartupStatus;
  onRestart?: (mode: StartupRestartMode) => Promise<boolean>;
}) {
  const { setting: themeSetting, setThemeSetting } = useTheme();
  const { locale, setting: localeSetting, setLocale } = useI18n();
  const [active, setActive] = useState<SectionId>(initialSection);
  const [versionText, setVersionText] = useState(`v${APP_VERSION}`);
  const [registryUrl, setRegistryUrl] = useState('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticLog | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsAction, setDiagnosticsAction] = useState<'idle' | 'exporting' | 'clearing'>('idle');
  const [diagnosticsStatus, setDiagnosticsStatus] = useState('');
  const [recoveryRestarting, setRecoveryRestarting] = useState(false);
  const diagnosticText = diagnosticsCopy(locale);
  const effectiveStartupStatus: StartupStatus = startupStatus ?? {
    safeMode: false,
    reason: null,
    consecutiveFailures: 0,
    failureThreshold: 2,
    startedAt: '',
  };
  const visibleNav = useMemo(
    () => NAV.filter((item) => !item.devOnly || ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL),
    [],
  );
  const activeNav = useMemo(() => visibleNav.find((item) => item.id === active), [active, visibleNav]);

  useEffect(() => {
    void appService.getInfo()?.then((value) => {
      const version = typeof value?.version === 'string' ? value.version : '';
      if (version) setVersionText(`v${version}`);
    });
  }, []);

  useEffect(() => {
    if (ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL) setRegistryUrl(loadMarketplaceRegistryUrl());
  }, []);

  useEffect(() => {
    setActive(initialSection);
  }, [initialSection]);

  const refreshDiagnostics = useCallback(async () => {
    const request = diagnosticsService.list();
    if (!request) {
      setDiagnosticsStatus(diagnosticsCopy(locale).unavailable);
      return;
    }
    setDiagnosticsLoading(true);
    try {
      setDiagnostics(await request);
    } catch {
      setDiagnosticsStatus(diagnosticsCopy(locale).loadFailed);
    } finally {
      setDiagnosticsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    if (active === 'diagnostics') void refreshDiagnostics();
  }, [active, refreshDiagnostics]);

  const recentDiagnostics = useMemo(
    () => [...(diagnostics?.events ?? [])].slice(-100).reverse(),
    [diagnostics],
  );

  const exportDiagnostics = async () => {
    const request = diagnosticsService.export();
    if (!request) return;
    setDiagnosticsAction('exporting');
    setDiagnosticsStatus('');
    try {
      const result = await request;
      setDiagnosticsStatus(
        result.success
          ? `${diagnosticText.savedTo} ${result.filePath}`
          : result.error === 'canceled'
            ? diagnosticText.exportCanceled
            : diagnosticText.exportFailed,
      );
    } catch {
      setDiagnosticsStatus(diagnosticText.exportFailed);
    } finally {
      setDiagnosticsAction('idle');
    }
  };

  const clearDiagnostics = async () => {
    if (!window.confirm(diagnosticText.clearConfirm)) return;
    const request = diagnosticsService.clear();
    if (!request) return;
    setDiagnosticsAction('clearing');
    setDiagnosticsStatus('');
    try {
      await request;
      setDiagnosticsStatus(diagnosticText.cleared);
      await refreshDiagnostics();
    } catch {
      setDiagnosticsStatus(diagnosticText.clearFailed);
    } finally {
      setDiagnosticsAction('idle');
    }
  };

  const restartFromRecovery = async () => {
    const mode: StartupRestartMode = effectiveStartupStatus.safeMode ? 'normal' : 'safe';
    const restart = onRestart ?? ((restartMode: StartupRestartMode) => appService.restart(restartMode));
    const request = restart(mode);
    if (!request) {
      setDiagnosticsStatus(diagnosticText.restartFailed);
      return;
    }
    setRecoveryRestarting(true);
    setDiagnosticsStatus('');
    try {
      const accepted = await request;
      if (!accepted) {
        setRecoveryRestarting(false);
        setDiagnosticsStatus(diagnosticText.restartFailed);
      }
    } catch {
      setRecoveryRestarting(false);
      setDiagnosticsStatus(diagnosticText.restartFailed);
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.nav}>
        <div className={styles.navHeader}>
          <div className={styles.navTitle}>Settings</div>
          <div className={styles.navSub}>{versionText}</div>
        </div>

        {GROUPS.map((group) => {
          const items = visibleNav.filter((item) => item.group === group);
          if (!items.length) return null;
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
                <div className={styles.headerSub}>{description(active)}</div>
              </div>
            </div>
          </div>

          {active === 'appearance' && (
            <div className={styles.stack}>
              <Card title="Theme" subtitle="Choose your interface color scheme">
                <div className={styles.themeRow}>
                  {[
                    { id: 'auto' as const, label: 'Auto' },
                    { id: 'dark' as const, label: 'Dark' },
                    { id: 'light' as const, label: 'Light' },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className={styles.themeCard}
                      data-active={themeSetting === theme.id ? '1' : '0'}
                      aria-pressed={themeSetting === theme.id}
                      onClick={() => setThemeSetting(theme.id)}
                    >
                      <ThemePreview theme={theme.id} />
                      <div className={styles.themeLabel}>{theme.label}</div>
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
                    {
                      id: 'auto' as const,
                      label: 'Auto (Follow System)',
                      sub: 'Uses your OS language setting',
                    },
                    { id: 'en' as const, label: 'English', sub: 'English' },
                    { id: 'zh-CN' as const, label: 'Simplified Chinese', sub: '简体中文' },
                  ].map((language) => (
                    <button
                      key={language.id}
                      type="button"
                      className={styles.langItem}
                      aria-pressed={localeSetting === language.id}
                      data-active={localeSetting === language.id ? '1' : '0'}
                      onClick={() => setLocale(language.id)}
                    >
                      <span className={styles.radio} data-active={localeSetting === language.id ? '1' : '0'}>
                        <span
                          className={styles.radioDot}
                          data-active={localeSetting === language.id ? '1' : '0'}
                        />
                      </span>
                      <span className={styles.langText}>
                        <span className={styles.langLabel}>{language.label}</span>
                        <span className={styles.langSub}>{language.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className={styles.notice}>
                  A restart may be required for language changes to fully take effect.
                </div>
              </Card>
            </div>
          )}

          {active === 'data' && ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL && (
            <div className={styles.stack}>
              <Card
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
              </Card>
            </div>
          )}

          {active === 'diagnostics' && (
            <div className={styles.stack}>
              <Card title={diagnosticText.recoveryTitle} subtitle={diagnosticText.recoverySubtitle}>
                <div className={styles.recoveryRow}>
                  <div className={styles.recoveryState}>
                    <span
                      className={styles.recoveryBadge}
                      data-safe={effectiveStartupStatus.safeMode ? '1' : '0'}
                    >
                      {effectiveStartupStatus.safeMode ? diagnosticText.safeMode : diagnosticText.normalMode}
                    </span>
                    <span className={styles.recoveryDescription}>
                      {effectiveStartupStatus.safeMode
                        ? diagnosticText.safeModeDescription
                        : diagnosticText.normalModeDescription}
                    </span>
                    <span className={styles.recoveryFailures}>
                      {diagnosticText.startupFailures}: {effectiveStartupStatus.consecutiveFailures}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={recoveryRestarting}
                    onClick={() => void restartFromRecovery()}
                  >
                    <VscDebugRestart />
                    {recoveryRestarting
                      ? diagnosticText.restarting
                      : effectiveStartupStatus.safeMode
                        ? diagnosticText.restartNormal
                        : diagnosticText.restartSafe}
                  </button>
                </div>
              </Card>

              <Card title={diagnosticText.title} subtitle={diagnosticText.subtitle}>
                <div className={styles.diagnosticMetrics}>
                  <div className={styles.diagnosticMetric}>
                    <span className={styles.diagnosticMetricValue}>{diagnostics?.events.length ?? 0}</span>
                    <span className={styles.diagnosticMetricLabel}>{diagnosticText.retained}</span>
                  </div>
                  <div className={styles.diagnosticMetric}>
                    <span className={styles.diagnosticMetricValue}>{diagnostics?.droppedCount ?? 0}</span>
                    <span className={styles.diagnosticMetricLabel}>{diagnosticText.dropped}</span>
                  </div>
                  <div className={styles.diagnosticMetric}>
                    <span className={styles.diagnosticMetricValue}>
                      {formatBytes(diagnostics?.maxBytes ?? 0)}
                    </span>
                    <span className={styles.diagnosticMetricLabel}>{diagnosticText.localLimit}</span>
                  </div>
                </div>
                <div className={styles.diagnosticActions}>
                  <button
                    type="button"
                    className={styles.smallBtn}
                    disabled={diagnosticsLoading || diagnosticsAction !== 'idle'}
                    onClick={() => void refreshDiagnostics()}
                  >
                    <VscRefresh />
                    {diagnosticText.refresh}
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    disabled={diagnosticsAction !== 'idle'}
                    onClick={() => void exportDiagnostics()}
                  >
                    <VscExport />
                    {diagnosticsAction === 'exporting' ? diagnosticText.exporting : diagnosticText.export}
                  </button>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    disabled={diagnosticsAction !== 'idle' || !diagnostics?.events.length}
                    onClick={() => void clearDiagnostics()}
                  >
                    <VscTrash />
                    {diagnosticText.clear}
                  </button>
                </div>
                <div className={styles.privacyNotice}>{diagnosticText.privacy}</div>
                {diagnosticsStatus && (
                  <div className={styles.diagnosticStatus} role="status">
                    {diagnosticsStatus}
                  </div>
                )}
              </Card>

              <Card title={diagnosticText.recentTitle} subtitle={diagnosticText.recentSubtitle}>
                {diagnosticsLoading ? (
                  <div className={styles.diagnosticEmpty}>{diagnosticText.loading}</div>
                ) : recentDiagnostics.length === 0 ? (
                  <div className={styles.diagnosticEmpty}>{diagnosticText.empty}</div>
                ) : (
                  <div className={styles.diagnosticList}>
                    {recentDiagnostics.map((event) => (
                      <div key={event.id} className={styles.diagnosticEvent}>
                        <div className={styles.diagnosticEventTop}>
                          <span className={styles.diagnosticLevel} data-level={event.level}>
                            {event.level}
                          </span>
                          <span className={styles.diagnosticSource}>
                            {event.source}
                            {event.scope ? ` · ${event.scope}` : ''}
                          </span>
                          <time className={styles.diagnosticTime} dateTime={event.timestamp}>
                            {new Date(event.timestamp).toLocaleString(locale)}
                          </time>
                        </div>
                        <div className={styles.diagnosticMessage}>{event.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {active === 'about' && (
            <div className={styles.stack}>
              <Card title="DevToolBox" subtitle="Developer productivity utilities hub">
                <div className={styles.aboutHero}>
                  <div className={styles.aboutLogo}>DT</div>
                  <div>
                    <div className={styles.aboutName}>DevToolBox</div>
                    <div className={styles.aboutMeta}>{`Version ${versionText.replace(/^v/, '')}`}</div>
                  </div>
                </div>
                <div className={styles.kv}>
                  {[
                    ['License', 'Apache-2.0'],
                    ['Runtime', 'Electron + React'],
                    ['Platform', 'macOS / Windows'],
                  ].map(([key, value]) => (
                    <div key={key} className={styles.kvRow}>
                      <span className={styles.kvKey}>{key}</span>
                      <span className={styles.kvVal}>{value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function description(id: SectionId): string {
  return {
    appearance: 'Theme and visual preferences',
    language: 'Interface display language and locale',
    data: 'Development marketplace source',
    diagnostics: 'Local runtime events and support bundle',
    about: 'Version info, license and credits',
  }[id];
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KiB`;
}

function ThemePreview({ theme }: { theme: 'auto' | 'dark' | 'light' }) {
  return (
    <span className={styles.themePreview} data-theme={theme} aria-hidden="true">
      <span className={styles.themePreviewPane} data-preview-theme={theme}>
        <span className={styles.themePreviewSidebar}>
          <span className={styles.themePreviewLogo} />
          <span className={styles.themePreviewNavActive} />
          <span className={styles.themePreviewNav} />
        </span>
        <span className={styles.themePreviewMain}>
          <span className={styles.themePreviewHeading} />
          <span className={styles.themePreviewLine} />
          <span className={styles.themePreviewPanels}>
            <span />
            <span />
          </span>
        </span>
      </span>
    </span>
  );
}

function diagnosticsCopy(locale: 'en' | 'zh-CN') {
  if (locale === 'zh-CN') {
    return {
      title: '本地诊断',
      subtitle: '查看脱敏后的运行时事件，或导出支持诊断包',
      retained: '保留事件',
      dropped: '已丢弃',
      localLimit: '本地上限',
      refresh: '刷新',
      export: '导出诊断包',
      exporting: '正在导出…',
      clear: '清空日志',
      privacy:
        '诊断数据只保存在本机。凭据、内容/正文/载荷字段、私钥和用户主目录会在写入前自动脱敏；只有点击导出后才会生成可分享的 JSON 文件。',
      recentTitle: '最近事件',
      recentSubtitle: '最多显示最近 100 条脱敏事件',
      loading: '正在读取诊断事件…',
      empty: '当前没有诊断事件。',
      unavailable: '当前运行环境不支持诊断功能。',
      loadFailed: '无法读取诊断事件。',
      savedTo: '诊断包已保存到：',
      exportCanceled: '已取消导出。',
      exportFailed: '诊断包导出失败。',
      clearConfirm: '确定要清空本机诊断日志吗？此操作无法撤销。',
      cleared: '本机诊断日志已清空。',
      clearFailed: '无法清空诊断日志。',
      recoveryTitle: '启动恢复',
      recoverySubtitle: '在插件隔离模式和正常模式之间安全重启',
      safeMode: '安全模式',
      normalMode: '正常模式',
      safeModeDescription: 'Marketplace 插件在本次会话中已暂停，不会修改它们的永久启用状态。',
      normalModeDescription: '内置工具和已启用的 Marketplace 插件会正常加载。',
      startupFailures: '连续启动失败',
      restartSafe: '以安全模式重启',
      restartNormal: '以正常模式重启',
      restarting: '正在重启…',
      restartFailed: '无法重新启动应用。',
    };
  }
  return {
    title: 'Local diagnostics',
    subtitle: 'Review redacted runtime events or export a support bundle',
    retained: 'Retained events',
    dropped: 'Dropped',
    localLimit: 'Local limit',
    refresh: 'Refresh',
    export: 'Export bundle',
    exporting: 'Exporting…',
    clear: 'Clear log',
    privacy:
      'Diagnostics stay on this device. Credentials, content/body/payload fields, private keys, and the home directory are redacted before storage; a shareable JSON file is created only when you export it.',
    recentTitle: 'Recent events',
    recentSubtitle: 'Shows up to the 100 most recent redacted events',
    loading: 'Loading diagnostic events…',
    empty: 'No diagnostic events have been recorded.',
    unavailable: 'Diagnostics are unavailable in this runtime.',
    loadFailed: 'Unable to load diagnostic events.',
    savedTo: 'Diagnostic bundle saved to:',
    exportCanceled: 'Export canceled.',
    exportFailed: 'Diagnostic bundle export failed.',
    clearConfirm: 'Clear the local diagnostic log? This cannot be undone.',
    cleared: 'Local diagnostic log cleared.',
    clearFailed: 'Unable to clear diagnostic events.',
    recoveryTitle: 'Startup recovery',
    recoverySubtitle: 'Restart safely with or without Marketplace plugin isolation',
    safeMode: 'Safe mode',
    normalMode: 'Normal mode',
    safeModeDescription:
      'Marketplace plugins are paused for this session without changing their enabled state.',
    normalModeDescription: 'Built-in tools and enabled Marketplace plugins load normally.',
    startupFailures: 'Consecutive startup failures',
    restartSafe: 'Restart in safe mode',
    restartNormal: 'Restart normally',
    restarting: 'Restarting…',
    restartFailed: 'Unable to restart the application.',
  };
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
