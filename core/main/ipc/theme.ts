import { app, nativeTheme, ipcMain, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type Theme = 'dark' | 'light';
export type ThemeSetting = 'auto' | Theme;

type StoredTheme = { setting: ThemeSetting };

function getThemePath(): string {
  return path.join(app.getPath('userData'), 'theme.json');
}

function resolveSystemTheme(): Theme {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function resolveTheme(setting: ThemeSetting): Theme {
  if (setting === 'auto') return resolveSystemTheme();
  return setting;
}

export function loadThemeSetting(): ThemeSetting {
  try {
    const raw = fs.readFileSync(getThemePath(), 'utf8');
    const parsed = JSON.parse(raw) as StoredTheme;
    const s = parsed?.setting;
    if (s === 'auto' || s === 'dark' || s === 'light') return s;
    return 'auto';
  } catch {
    return 'auto';
  }
}

function saveThemeSetting(setting: ThemeSetting): void {
  try {
    fs.writeFileSync(getThemePath(), JSON.stringify({ setting } satisfies StoredTheme, null, 2), 'utf8');
  } catch {
    void 0;
  }
}

let currentSetting: ThemeSetting = 'auto';
let currentTheme: Theme = 'dark';

export function getCurrentTheme(): Theme {
  return currentTheme;
}

export function getCurrentThemeSetting(): ThemeSetting {
  return currentSetting;
}

export function setCurrentThemeSetting(setting: ThemeSetting): void {
  currentSetting = setting;
  currentTheme = resolveTheme(setting);
  saveThemeSetting(setting);
}

export function register(onThemeChanged: (theme: Theme) => void): void {
  currentSetting = loadThemeSetting();
  currentTheme = resolveTheme(currentSetting);

  ipcMain.handle('app:setTheme', (_event, setting: string) => {
    const next: ThemeSetting = setting === 'auto' || setting === 'dark' || setting === 'light' ? setting : 'auto';
    setCurrentThemeSetting(next);
    onThemeChanged(currentTheme);
  });

  ipcMain.handle('app:getTheme', () => {
    return { setting: currentSetting, theme: currentTheme };
  });
}

export function broadcastThemeChange(theme: Theme): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('theme:changed', theme);
  }
}
