import { BrowserWindow } from 'electron';
import path from 'path';
import type { DiagnosticStore } from './diagnostics';
import { createRendererNavigationTarget, isRendererNavigationAllowed } from './navigation-policy';

const WINDOW_CONFIG = {
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  center: true,
  title: 'DevToolBox',
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    preload: path.join(__dirname, '../preload/index.js'),
  },
};

export function createMainWindow({
  diagnostics,
  onClosed,
}: {
  diagnostics: DiagnosticStore;
  onClosed: (window: BrowserWindow) => void;
}): BrowserWindow {
  const window = new BrowserWindow({
    ...WINDOW_CONFIG,
  });
  const navigationTarget = createRendererNavigationTarget(
    process.env.VITE_DEV_SERVER_URL,
    path.join(__dirname, '../../dist/index.html'),
  );
  const guardNavigation = (event: Electron.Event, targetUrl: string) => {
    if (isRendererNavigationAllowed(targetUrl, navigationTarget.policy)) return;
    event.preventDefault();
    diagnostics.record({
      level: 'warn',
      source: 'main',
      scope: 'renderer-navigation',
      message: 'Blocked an untrusted main-window navigation',
    });
  };

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', guardNavigation);
  window.webContents.on('will-redirect', guardNavigation);
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  window.on('closed', () => onClosed(window));
  window.on('unresponsive', () => {
    diagnostics.record({
      level: 'warn',
      source: 'main',
      scope: 'browser-window',
      message: 'Main window became unresponsive',
    });
  });
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    diagnostics.record({
      level: 'error',
      source: 'main',
      scope: 'preload',
      message: 'Preload script failed',
      details: { preloadPath, error },
    });
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    diagnostics.record({
      level: details.reason === 'clean-exit' ? 'info' : 'error',
      source: 'main',
      scope: 'renderer-process',
      message: `Renderer process exited: ${details.reason}`,
      details,
    });
  });

  // Keep native window controls visible on Windows/Linux while still opening large.
  if (process.platform === 'darwin') {
    window.setFullScreen(true);
  } else {
    window.maximize();
  }

  void window.loadURL(navigationTarget.entryUrl);
  return window;
}
