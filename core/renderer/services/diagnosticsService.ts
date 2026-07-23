import type { DiagnosticExportResult, DiagnosticLog, RendererDiagnosticEventInput } from '@devtoolbox/core';
import { getElectronApi } from '../lib/electron';

export const diagnosticsService = {
  record(event: RendererDiagnosticEventInput): Promise<boolean> | undefined {
    return getElectronApi()?.diagnosticsRecord(event);
  },

  list(): Promise<DiagnosticLog> | undefined {
    return getElectronApi()?.diagnosticsList();
  },

  clear(): Promise<boolean> | undefined {
    return getElectronApi()?.diagnosticsClear();
  },

  export(): Promise<DiagnosticExportResult> | undefined {
    return getElectronApi()?.diagnosticsExport();
  },
};
