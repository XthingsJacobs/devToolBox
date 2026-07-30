import { VscDebugRestart, VscExport, VscRefresh, VscTrash } from 'react-icons/vsc';
import type { DiagnosticLog, StartupStatus } from '@devtoolbox/core';
import styles from './SettingsPage.module.css';
import { SettingsCard } from './SettingsCard';
import { formatDiagnosticBytes, type DiagnosticsCopy } from './SettingsPage.model';
import type { DiagnosticsAction } from './useSettingsDiagnostics';

export function DiagnosticsSection({
  diagnosticText,
  startupStatus,
  diagnostics,
  diagnosticsLoading,
  diagnosticsAction,
  diagnosticsStatus,
  recoveryRestarting,
  recentDiagnostics,
  locale,
  onRefresh,
  onExport,
  onClear,
  onRestart,
}: {
  diagnosticText: DiagnosticsCopy;
  startupStatus: StartupStatus;
  diagnostics: DiagnosticLog | null;
  diagnosticsLoading: boolean;
  diagnosticsAction: DiagnosticsAction;
  diagnosticsStatus: string;
  recoveryRestarting: boolean;
  recentDiagnostics: DiagnosticLog['events'];
  locale: string;
  onRefresh: () => void;
  onExport: () => void;
  onClear: () => void;
  onRestart: () => void;
}) {
  return (
    <div className={styles.stack}>
      <SettingsCard title={diagnosticText.recoveryTitle} subtitle={diagnosticText.recoverySubtitle}>
        <div className={styles.recoveryRow}>
          <div className={styles.recoveryState}>
            <span className={styles.recoveryBadge} data-safe={startupStatus.safeMode ? '1' : '0'}>
              {startupStatus.safeMode ? diagnosticText.safeMode : diagnosticText.normalMode}
            </span>
            <span className={styles.recoveryDescription}>
              {startupStatus.safeMode
                ? diagnosticText.safeModeDescription
                : diagnosticText.normalModeDescription}
            </span>
            <span className={styles.recoveryFailures}>
              {diagnosticText.startupFailures}: {startupStatus.consecutiveFailures}
            </span>
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={recoveryRestarting}
            onClick={onRestart}
          >
            <VscDebugRestart />
            {recoveryRestarting
              ? diagnosticText.restarting
              : startupStatus.safeMode
                ? diagnosticText.restartNormal
                : diagnosticText.restartSafe}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title={diagnosticText.title} subtitle={diagnosticText.subtitle}>
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
              {formatDiagnosticBytes(diagnostics?.maxBytes ?? 0)}
            </span>
            <span className={styles.diagnosticMetricLabel}>{diagnosticText.localLimit}</span>
          </div>
        </div>
        <div className={styles.diagnosticActions}>
          <button
            type="button"
            className={styles.smallBtn}
            disabled={diagnosticsLoading || diagnosticsAction !== 'idle'}
            onClick={onRefresh}
          >
            <VscRefresh />
            {diagnosticText.refresh}
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={diagnosticsAction !== 'idle'}
            onClick={onExport}
          >
            <VscExport />
            {diagnosticsAction === 'exporting' ? diagnosticText.exporting : diagnosticText.export}
          </button>
          <button
            type="button"
            className={styles.dangerBtn}
            disabled={diagnosticsAction !== 'idle' || !diagnostics?.events.length}
            onClick={onClear}
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
      </SettingsCard>

      <SettingsCard title={diagnosticText.recentTitle} subtitle={diagnosticText.recentSubtitle}>
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
      </SettingsCard>
    </div>
  );
}
