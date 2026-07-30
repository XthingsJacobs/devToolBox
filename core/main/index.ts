import type { BrowserWindow } from 'electron';
import { registerMainIpc } from './main-ipc';
import { registerMainLifecycle } from './main-lifecycle';
import { buildMainMenu, type MainMenuOptions } from './main-menu';
import {
  APP_VERSION,
  BUILD_NUMBER,
  configureMainProcessApp,
  createDiagnosticStore,
  createStartupHealthTracker,
  recordStartupMode,
} from './main-startup';
import { createMainWindow } from './main-window';

configureMainProcessApp();

const diagnostics = createDiagnosticStore();
const startupHealth = createStartupHealthTracker();
const startupStatus = startupHealth.beginStartup();
recordStartupMode(diagnostics, startupStatus);

let mainWindow: BrowserWindow | null = null;

const getMainWindow = () => mainWindow;
const menuOptions: MainMenuOptions = {
  appVersion: APP_VERSION,
  buildNumber: BUILD_NUMBER,
  getMainWindow,
};
const rebuildMenu = () => buildMainMenu(menuOptions);
const openMainWindow = () => {
  mainWindow = createMainWindow({
    diagnostics,
    onClosed: (closedWindow) => {
      if (mainWindow === closedWindow) mainWindow = null;
    },
  });
};

registerMainIpc({
  appVersion: APP_VERSION,
  buildNumber: BUILD_NUMBER,
  diagnostics,
  startupHealth,
  startupStatus,
  rebuildMenu,
});

registerMainLifecycle({
  buildMenu: rebuildMenu,
  createWindow: openMainWindow,
  getMainWindow,
  diagnostics,
  startupHealth,
  startupStatus,
});
