import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { applyLocaleSetting } from './locale';
import { applyThemeSetting } from './theme';
import { applyUpdateSettings } from './updates';

async function dirSizeBytes(dirPath: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    let total = 0;
    for (const e of entries) {
      const p = path.join(dirPath, e.name);
      if (e.isDirectory()) {
        total += await dirSizeBytes(p);
        continue;
      }
      if (e.isFile()) {
        const st = await fs.promises.stat(p);
        total += st.size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

function getMarketplaceCacheDir(): string {
  return path.join(app.getPath('userData'), 'marketplace-cache');
}

function getUserDataDir(): string {
  return app.getPath('userData');
}

async function removeLocalStorageKey(win: BrowserWindow, key: string): Promise<void> {
  try {
    await win.webContents.executeJavaScript(`try { localStorage.removeItem(${JSON.stringify(key)}); } catch {}`, true);
  } catch {
    void 0;
  }
}

async function removeLocalStorageKeys(win: BrowserWindow, keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => removeLocalStorageKey(win, k)));
}

async function getCacheBytes(win: BrowserWindow | null): Promise<number> {
  let sessionBytes = 0;
  try {
    const s = win?.webContents?.session as unknown as { getCacheSize?: () => Promise<number> };
    if (typeof s?.getCacheSize === 'function') sessionBytes = await s.getCacheSize();
  } catch {
    sessionBytes = 0;
  }

  const marketplaceBytes = await dirSizeBytes(getMarketplaceCacheDir());
  return sessionBytes + marketplaceBytes;
}

export function register(): void {
  ipcMain.handle('storage:getInfo', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? null;
    const cacheBytes = await getCacheBytes(win);
    return { cacheBytes };
  });

  ipcMain.handle('storage:resetSettings', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'no_window' };

    const confirm = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Reset'],
      defaultId: 1,
      cancelId: 0,
      message: 'Reset all settings?',
      detail: 'This will restore theme, language and update preferences to defaults.',
    });
    if (confirm.response !== 1) return { success: false, canceled: true };

    applyThemeSetting('auto');
    applyLocaleSetting('auto');
    applyUpdateSettings({ autoCheck: false });
    await removeLocalStorageKeys(win, [
      'devtoolbox_marketplace_registry_url',
      'devtoolbox_theme_setting',
      'devtoolbox_locale_setting',
    ]);

    return { success: true };
  });

  ipcMain.handle('storage:deleteAllData', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'no_window' };

    const confirm = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 1,
      cancelId: 0,
      message: 'Delete all data?',
      detail: 'This will permanently remove all local app data (including plugins). The app will restart.',
    });
    if (confirm.response !== 1) return { success: false, canceled: true };

    try {
      const s = win.webContents.session as unknown as {
        clearCache?: () => Promise<void>;
        clearStorageData?: (options?: { storages?: string[] }) => Promise<void>;
      };
      await s.clearCache?.();
      await s.clearStorageData?.({
        storages: ['appcache', 'cachestorage', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'serviceworkers', 'shadercache', 'websql'],
      });
    } catch {
      void 0;
    }

    try {
      await fs.promises.rm(getUserDataDir(), { recursive: true, force: true });
    } catch {
      void 0;
    }

    setTimeout(() => {
      try {
        app.relaunch();
        app.exit(0);
      } catch {
        void 0;
      }
    }, 200);

    return { success: true, relaunch: true };
  });

  ipcMain.handle('storage:clear', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { success: false, error: 'no_window' };

    const confirm = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Clear'],
      defaultId: 1,
      cancelId: 0,
      message: 'Clear storage cache?',
      detail: 'This will clear temporary cache data. App settings will be kept.',
    });
    if (confirm.response !== 1) return { success: false, canceled: true };

    try {
      const s = win.webContents.session as unknown as {
        clearCache?: () => Promise<void>;
        clearStorageData?: (options?: { storages?: string[] }) => Promise<void>;
      };
      await s.clearCache?.();
      await s.clearStorageData?.({
        storages: ['cachestorage', 'indexdb', 'serviceworkers', 'shadercache', 'websql'],
      });
    } catch {
      void 0;
    }

    try {
      await fs.promises.rm(getMarketplaceCacheDir(), { recursive: true, force: true });
    } catch {
      void 0;
    }

    const cacheBytes = await getCacheBytes(win);
    return { success: true, cacheBytes };
  });
}
