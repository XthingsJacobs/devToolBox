import { app, ipcMain } from 'electron';
import type { StartupHealthTracker } from '../startup-health';

export function register(tracker: StartupHealthTracker): void {
  let restarting = false;

  ipcMain.handle('startup:getStatus', () => tracker.getStatus());
  ipcMain.handle('startup:rendererReady', () => {
    tracker.markRendererReady();
    return true;
  });
  ipcMain.handle('startup:restart', (_event, mode: unknown) => {
    if (mode !== 'normal' && mode !== 'safe') return false;
    if (restarting) return true;
    restarting = true;
    tracker.prepareRestart(mode);
    setTimeout(() => {
      app.relaunch();
      app.quit();
    }, 50);
    return true;
  });
}
