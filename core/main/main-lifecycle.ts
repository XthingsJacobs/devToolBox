import { app, type BrowserWindow } from 'electron';
import type { StartupStatus } from '@devtoolbox/core';
import { register as registerHttpIpc } from './ipc/http';
import { registerPluginProtocol } from './protocols/plugin-protocol';
import { initUpdater } from './updater';
import type { DiagnosticStore } from './diagnostics';
import type { StartupHealthTracker } from './startup-health';

export function registerMainLifecycle({
  buildMenu,
  createWindow,
  getMainWindow,
  diagnostics,
  startupHealth,
  startupStatus,
}: {
  buildMenu: () => void;
  createWindow: () => void;
  getMainWindow: () => BrowserWindow | null;
  diagnostics: DiagnosticStore;
  startupHealth: StartupHealthTracker;
  startupStatus: StartupStatus;
}): void {
  let flushingStorage = false;

  app.on('ready', () => {
    buildMenu();
    registerPluginProtocol({ runtimeEnabled: () => !startupStatus.safeMode });
    createWindow();
    registerHttpIpc();
    initUpdater(getMainWindow);
  });

  app.on('before-quit', (event) => {
    startupHealth.markCleanExit();
    if (flushingStorage) return;

    const window = getMainWindow();
    if (!window) return;

    const session = window.webContents.session as unknown as { flushStorageData?: () => Promise<void> };
    if (typeof session.flushStorageData !== 'function') return;

    flushingStorage = true;
    event.preventDefault();
    void Promise.resolve()
      .then(() => session.flushStorageData?.())
      .catch(() => undefined)
      .then(() => {
        app.quit();
      });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  const handleSignal = () => {
    try {
      app.quit();
    } catch {
      void 0;
    }
  };
  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
  process.on('uncaughtExceptionMonitor', (error, origin) => {
    diagnostics.record({
      level: 'error',
      source: 'main',
      scope: 'uncaught-exception',
      message: error.message || 'Uncaught main-process exception',
      details: { origin, error },
    });
  });
}
