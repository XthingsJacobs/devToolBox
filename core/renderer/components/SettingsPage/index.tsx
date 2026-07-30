import { useMemo } from 'react';
import type { StartupRestartMode, StartupStatus } from '@devtoolbox/core';
import { ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL } from '../../marketplace/registry';
import { useI18n } from '../../i18n';
import { useTheme } from '../../theme';
import styles from './SettingsPage.module.css';
import { AboutSection } from './AboutSection';
import { AppearanceSection } from './AppearanceSection';
import { DiagnosticsSection } from './DiagnosticsSection';
import { LanguageSection } from './LanguageSection';
import { MarketplaceRegistrySection } from './MarketplaceRegistrySection';
import { SettingsNavigation, getVisibleSettingsNav, type SettingsNavItem } from './SettingsNavigation';
import { describeSettingsSection, type SectionId } from './SettingsPage.model';
import { useSettingsDiagnostics } from './useSettingsDiagnostics';
import { useSettingsPageState } from './useSettingsPageState';

export type { SectionId } from './SettingsPage.model';

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
  const { active, setActive, versionText, registryUrl, setRegistryUrl } =
    useSettingsPageState(initialSection);
  const visibleNav = useMemo(() => getVisibleSettingsNav(), []);
  const activeNav = useMemo<SettingsNavItem | undefined>(
    () => visibleNav.find((item) => item.id === active),
    [active, visibleNav],
  );
  const diagnostics = useSettingsDiagnostics({
    active,
    locale,
    startupStatus,
    onRestart,
  });

  return (
    <div className={styles.page}>
      <SettingsNavigation
        versionText={versionText}
        visibleNav={visibleNav}
        active={active}
        onSelect={setActive}
      />

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
                <div className={styles.headerSub}>{describeSettingsSection(active)}</div>
              </div>
            </div>
          </div>

          {active === 'appearance' && (
            <AppearanceSection themeSetting={themeSetting} onThemeChange={setThemeSetting} />
          )}

          {active === 'language' && (
            <LanguageSection localeSetting={localeSetting} onLocaleChange={setLocale} />
          )}

          {active === 'data' && ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL && (
            <MarketplaceRegistrySection registryUrl={registryUrl} setRegistryUrl={setRegistryUrl} />
          )}

          {active === 'diagnostics' && (
            <DiagnosticsSection
              diagnosticText={diagnostics.diagnosticText}
              startupStatus={diagnostics.effectiveStartupStatus}
              diagnostics={diagnostics.diagnostics}
              diagnosticsLoading={diagnostics.diagnosticsLoading}
              diagnosticsAction={diagnostics.diagnosticsAction}
              diagnosticsStatus={diagnostics.diagnosticsStatus}
              recoveryRestarting={diagnostics.recoveryRestarting}
              recentDiagnostics={diagnostics.recentDiagnostics}
              locale={locale}
              onRefresh={() => void diagnostics.refreshDiagnostics()}
              onExport={() => void diagnostics.exportDiagnostics()}
              onClear={() => void diagnostics.clearDiagnostics()}
              onRestart={() => void diagnostics.restartFromRecovery()}
            />
          )}

          {active === 'about' && <AboutSection versionText={versionText} />}
        </div>
      </main>
    </div>
  );
}
