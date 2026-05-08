import { app, ipcMain, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type Locale = 'en' | 'zh-CN';
export type LocaleSetting = 'auto' | Locale;

type StoredLocale = { setting: LocaleSetting };

function getLocalePath(): string {
  return path.join(app.getPath('userData'), 'locale.json');
}

function resolveSystemLocale(): Locale {
  const raw = String(app.getLocale?.() ?? '').toLowerCase();
  if (raw.startsWith('zh')) return 'zh-CN';
  return 'en';
}

function resolveLocale(setting: LocaleSetting): Locale {
  if (setting === 'auto') return resolveSystemLocale();
  return setting;
}

export function loadLocaleSetting(): LocaleSetting {
  try {
    const raw = fs.readFileSync(getLocalePath(), 'utf8');
    const parsed = JSON.parse(raw) as StoredLocale;
    const s = parsed?.setting;
    if (s === 'auto' || s === 'en' || s === 'zh-CN') return s;
    return 'auto';
  } catch {
    return 'auto';
  }
}

function saveLocaleSetting(setting: LocaleSetting): void {
  try {
    fs.writeFileSync(getLocalePath(), JSON.stringify({ setting } satisfies StoredLocale, null, 2), 'utf8');
  } catch {
    void 0;
  }
}

let currentSetting: LocaleSetting = 'auto';
let currentLocale: Locale = 'en';

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function getCurrentLocaleSetting(): LocaleSetting {
  return currentSetting;
}

export function setCurrentLocaleSetting(setting: LocaleSetting): void {
  currentSetting = setting;
  currentLocale = resolveLocale(setting);
  saveLocaleSetting(setting);
}

export function register(onLocaleChanged: (locale: Locale) => void): void {
  currentSetting = loadLocaleSetting();
  currentLocale = resolveLocale(currentSetting);

  ipcMain.handle('app:setLocale', (_event, setting: string) => {
    const next: LocaleSetting = setting === 'auto' || setting === 'zh-CN' || setting === 'en' ? setting : 'auto';
    setCurrentLocaleSetting(next);
    onLocaleChanged(currentLocale);
  });

  ipcMain.handle('app:getLocale', () => {
    return { setting: currentSetting, locale: currentLocale };
  });
}

export function broadcastLocaleChange(locale: Locale): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('locale:changed', locale);
  }
}
