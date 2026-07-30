import { app } from 'electron';
import path from 'path';
import type { StartupStatus } from '@devtoolbox/core';
import { DiagnosticStore } from './diagnostics';
import { registerPluginScheme } from './protocols/plugin-protocol';
import { StartupHealthTracker } from './startup-health';

export const APP_VERSION = app.getVersion().split('-')[0];
export const BUILD_NUMBER = '20260317';
export const IS_DEV = Boolean(process.env.VITE_DEV_SERVER_URL);

export function configureMainProcessApp(): void {
  app.name = 'DevToolBox';
  registerPluginScheme();

  if (IS_DEV) {
    app.setPath('userData', path.join(app.getPath('appData'), 'DevToolBox-dev'));
  }
}

export function createDiagnosticStore(): DiagnosticStore {
  return new DiagnosticStore({
    filePath: path.join(app.getPath('userData'), 'diagnostics', 'events.json'),
    onPersistenceError: (error) => console.warn('Unable to persist diagnostics:', error),
  });
}

export function createStartupHealthTracker(): StartupHealthTracker {
  return new StartupHealthTracker({
    filePath: path.join(app.getPath('userData'), 'diagnostics', 'startup-health.json'),
    onPersistenceError: (error) => console.warn('Unable to persist startup health:', error),
  });
}

export function recordStartupMode(diagnostics: DiagnosticStore, startupStatus: StartupStatus): void {
  if (!startupStatus.safeMode) return;

  diagnostics.record({
    level: 'warn',
    source: 'main',
    scope: 'startup.safe-mode',
    message:
      startupStatus.reason === 'manual'
        ? 'Application started in user-requested safe mode'
        : 'Application entered safe mode after repeated incomplete startups',
    details: { consecutiveFailures: startupStatus.consecutiveFailures },
  });
}
