import type {
  BackupExportOptions,
  BackupExportResult,
  BackupImportParams,
  BackupImportResult,
} from '@devtoolbox/core';
import { getElectronApi } from '../lib/electron';

export const backupService = {
  exportBackup(options: BackupExportOptions): Promise<BackupExportResult> | undefined {
    return getElectronApi()?.backupExport(options);
  },

  importBackup(params: BackupImportParams): Promise<BackupImportResult> | undefined {
    return getElectronApi()?.backupImport(params);
  },
};
