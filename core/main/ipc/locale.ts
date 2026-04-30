import { ipcMain, BrowserWindow } from 'electron';

type Locale = 'en';

export function loadLocale(): Locale {
  return 'en';
}

function saveLocale(_locale: Locale): void {
  return;
}

let currentLocale: Locale = 'en';

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale;
  saveLocale(locale);
}

export function register(onLocaleChanged: (locale: Locale) => void): void {
  currentLocale = loadLocale();

  ipcMain.handle('app:setLocale', (_event, locale: string) => {
    if (locale !== 'en') return;
    setCurrentLocale('en');
    onLocaleChanged('en');
  });

  ipcMain.handle('app:getLocale', () => {
    return currentLocale;
  });
}

/** Notify all renderer processes that the locale has changed */
export function broadcastLocaleChange(locale: Locale): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('locale:changed', locale);
  }
}
