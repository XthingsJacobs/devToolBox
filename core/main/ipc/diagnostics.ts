import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BrowserWindow, app, dialog, ipcMain, type SaveDialogOptions, type WebContents } from 'electron';
import type {
  DiagnosticExportResult,
  DiagnosticLevel,
  RendererDiagnosticEventInput,
  StartupStatus,
} from '@devtoolbox/core';
import type { DiagnosticStore } from '../diagnostics';
import { isRecord } from './validation';

const RENDERER_LEVELS = new Set<DiagnosticLevel>(['debug', 'info', 'warn', 'error']);

export interface DiagnosticApplicationContext {
  version: string;
  build: string;
  startupStatus?: StartupStatus;
}

function validateRendererEvent(value: unknown): RendererDiagnosticEventInput | undefined {
  if (!isRecord(value)) return undefined;
  if (value.source !== 'renderer' && value.source !== 'tool') return undefined;
  if (typeof value.level !== 'string' || !RENDERER_LEVELS.has(value.level as DiagnosticLevel)) {
    return undefined;
  }
  if (typeof value.message !== 'string' || !value.message.trim() || value.message.length > 10_000) {
    return undefined;
  }
  if (value.scope !== undefined && (typeof value.scope !== 'string' || value.scope.length > 512)) {
    return undefined;
  }
  return {
    level: value.level as DiagnosticLevel,
    source: value.source,
    scope: typeof value.scope === 'string' ? value.scope : undefined,
    message: value.message,
    details: value.details,
  };
}

function ownerWindow(sender: WebContents): BrowserWindow | undefined {
  return BrowserWindow.fromWebContents(sender) ?? undefined;
}

function exportFileName(date: Date): string {
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `DevToolBox-diagnostics-${timestamp}.json`;
}

export function createDiagnosticBundle(
  store: DiagnosticStore,
  context: DiagnosticApplicationContext,
  generatedAt = new Date(),
) {
  const log = store.snapshot();
  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    application: {
      name: 'DevToolBox',
      version: context.version,
      build: context.build,
      packaged: app.isPackaged,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    },
    system: {
      platform: process.platform,
      architecture: process.arch,
      osRelease: os.release(),
      locale: app.getLocale(),
    },
    retention: {
      eventCount: log.events.length,
      droppedCount: log.droppedCount,
      maxEvents: log.maxEvents,
      maxBytes: log.maxBytes,
    },
    startup: context.startupStatus,
    events: log.events,
  };
}

export function register(store: DiagnosticStore, context: DiagnosticApplicationContext): void {
  ipcMain.handle('diagnostics:record', (_event, value: unknown) => {
    const input = validateRendererEvent(value);
    if (!input) return false;
    return Boolean(store.record(input));
  });

  ipcMain.handle('diagnostics:list', () => store.snapshot());
  ipcMain.handle('diagnostics:clear', () => {
    store.clear();
    return true;
  });

  ipcMain.handle('diagnostics:export', async (event): Promise<DiagnosticExportResult> => {
    const generatedAt = new Date();
    const options: SaveDialogOptions = {
      title: 'Export Diagnostic Bundle',
      defaultPath: exportFileName(generatedAt),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    };
    const win = ownerWindow(event.sender);
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { success: false, error: 'canceled' };

    try {
      const bundle = createDiagnosticBundle(store, context, generatedAt);
      fs.writeFileSync(result.filePath, `${JSON.stringify(bundle, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'w',
        mode: 0o600,
      });
      try {
        fs.chmodSync(result.filePath, 0o600);
      } catch {
        // Some filesystems do not implement POSIX modes.
      }
      return { success: true, filePath: path.resolve(result.filePath) };
    } catch (error) {
      store.record({
        level: 'error',
        source: 'main',
        scope: 'diagnostics.export',
        message: 'Failed to export diagnostic bundle',
        details: error,
      });
      return { success: false, error: 'write_failed' };
    }
  });
}
