import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiagnosticLog, Locale, StartupRestartMode, StartupStatus } from '@devtoolbox/core';
import { appService, diagnosticsService } from '../../services';
import {
  DEFAULT_STARTUP_STATUS,
  diagnosticsCopy,
  type DiagnosticsCopy,
  type SectionId,
} from './SettingsPage.model';

export type DiagnosticsAction = 'idle' | 'exporting' | 'clearing';

export function useSettingsDiagnostics({
  active,
  locale,
  startupStatus,
  onRestart,
}: {
  active: SectionId;
  locale: Locale;
  startupStatus?: StartupStatus;
  onRestart?: (mode: StartupRestartMode) => Promise<boolean>;
}) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticLog | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsAction, setDiagnosticsAction] = useState<DiagnosticsAction>('idle');
  const [diagnosticsStatus, setDiagnosticsStatus] = useState('');
  const [recoveryRestarting, setRecoveryRestarting] = useState(false);
  const diagnosticText: DiagnosticsCopy = diagnosticsCopy(locale);
  const effectiveStartupStatus: StartupStatus = startupStatus ?? DEFAULT_STARTUP_STATUS;

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

  const exportDiagnostics = useCallback(async () => {
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
  }, [diagnosticText.exportCanceled, diagnosticText.exportFailed, diagnosticText.savedTo]);

  const clearDiagnostics = useCallback(async () => {
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
  }, [diagnosticText.clearConfirm, diagnosticText.clearFailed, diagnosticText.cleared, refreshDiagnostics]);

  const restartFromRecovery = useCallback(async () => {
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
  }, [diagnosticText.restartFailed, effectiveStartupStatus.safeMode, onRestart]);

  return {
    diagnostics,
    diagnosticsLoading,
    diagnosticsAction,
    diagnosticsStatus,
    diagnosticText,
    effectiveStartupStatus,
    recoveryRestarting,
    recentDiagnostics,
    refreshDiagnostics,
    exportDiagnostics,
    clearDiagnostics,
    restartFromRecovery,
  };
}
