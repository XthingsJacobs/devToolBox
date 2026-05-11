import { app, BrowserWindow, Menu, dialog, nativeImage } from 'electron';
import path from 'path';
import { register as registerFileIpc } from './ipc/file';
import { register as registerAppIpc } from './ipc/app';
import { register as registerMarketplaceIpc } from './ipc/marketplace';
import { register as registerBackupIpc } from './ipc/backup';
import { register as registerHttpIpc } from './ipc/http';
import { checkForUpdatesInteractive, initUpdater } from './updater';
import {
  register as registerLocaleIpc,
  getCurrentLocale,
  getCurrentLocaleSetting,
  broadcastLocaleChange,
  setCurrentLocaleSetting,
} from './ipc/locale';
import {
  register as registerThemeIpc,
  getCurrentTheme,
  getCurrentThemeSetting,
  broadcastThemeChange,
  setCurrentThemeSetting,
} from './ipc/theme';

// Auto-scan module-level IPC (removing a module folder removes its IPC automatically)
const moduleIpcFiles = import.meta.glob<{ register: () => void }>(
  [
    '../renderer/components/ModuleTools/*/ipc.ts',
  ],
  { eager: true },
);

type Locale = ReturnType<typeof getCurrentLocale>;

const APP_VERSION = app.getVersion().split('-')[0];
const BUILD_NUMBER = '20260317';

app.name = 'DevToolBox';

const IS_DEV = Boolean(process.env.VITE_DEV_SERVER_URL);
if (IS_DEV) {
  app.setPath('userData', path.join(app.getPath('appData'), 'DevToolBox-dev'));
}

let mainWindow: BrowserWindow | null = null;
let flushingStorage = false;

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
    preload: path.join(__dirname, '../preload/index.js'),
  },
};

// Menu localized text
const menuText: Record<Locale, Record<string, string>> = {
  en: {
    about: 'About',
    aboutTitle: 'About DevToolBox',
    company: 'Company',
    developer: 'Developer',
    version: 'Version',
    build: 'Build',
    settings: 'Settings…',
    exportData: 'Export…',
    importData: 'Import…',
    view: 'View',
    language: 'Language',
    langAuto: 'Auto',
    langEn: 'English',
    langZhCN: '简体中文',
    theme: 'Theme',
    themeAuto: 'Auto',
    themeDark: 'Dark',
    themeLight: 'Light',
    help: 'Help',
    checkUpdates: 'Check for Updates…',
  },
  'zh-CN': {
    about: '关于',
    aboutTitle: '关于 DevToolBox',
    company: '公司',
    developer: '开发者',
    version: '版本',
    build: '构建号',
    settings: '设置…',
    exportData: '导出…',
    importData: '导入…',
    view: '窗口',
    language: '语言',
    langAuto: '自动',
    langEn: 'English',
    langZhCN: '简体中文',
    theme: '主题',
    themeAuto: '自动',
    themeDark: '深色',
    themeLight: '浅色',
    help: '帮助',
    checkUpdates: '检查更新…',
  },
};

function getAboutIcon(): Electron.NativeImage {
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAqBJREFUWEftl01IVFEUx//nzoy' +
      'OOjqOH+MHaGZmZkRBi4iiIIigRYsWtYigTdCiRbSIFkFBm4I2QYsIoqBFi6BNRBBBRERERkZmfuT4Mc6Mzrx57xbd4c3Me/PezIy06cKFe+85v/8599x7' +
      'LsE//5G/zU8B/ncFqAL/vwJkqgBVoFIFyMxPAXYBOAzgIIAGALEyBZ4DuAfgAYDFcnwoKcDOANcBHAFQW6awADAP4BaA6wCelONLUQF2B7gD4GiZwqV2fw' +
      'rgOIBn5fhUKMBuAA8BdJUpWs7uDwAOAXhcjm9OAXYBuA/gWJmipXZ/BOAwgKfl+OYUoAvAIwAnyhQttftDAEcAPCvHN6cAXQAeADhZpqjb7g8AHAXwvBzf' +
      'CgXYA+AegNNlCpe6+30AxwC8KMc3pwA9AO4COFOmqNvudwGcAPCyHN+cAvQCuAPgbJnCpXa/A+AkgFfl+FYoQB+A2wDOlSlaavc7AE4BeFOOb04B+gHcAn' +
      'C+TFGX3W8BOA3gbTm+OQUYAHATwIUyhUvtfhPAGQDvyvHNKcAggBsALpYp6rb7DQBnAbwvx7dCAYYAXAdwqUzRUrtfA3AOwIdyfHMKMAzgKoDLZQqX2v0q' +
      'gPMAPpbjm1OAEQBXAHSXKVS0+xUAFwB8Ksc3pwCjAC4D6ClT1G33SwAuAvhcjm9OAcYAdAPoLVO41O6XAFwC8KUc35wCjAPoAtBXpqjb7l0ALgP4Wo5vhQ' +
      'JMAOgE0F+mqMvuHQCuAPhWjm9OASYBdAAYKFO41O4dAK4C+F6Ob04BpgC0AxgsU9Rt93YA1wD8KMe3QgGmAbQBGCpT1GX3NgDXAfwsxzenADMA2gAMlyns' +
      'svs1ADeAX+X45hRgFkArgJEyRf8A+AXgN/sPMCGPMHMAAAAASUVORK5CYII=',
  );
}

function getMenuIcon(): Electron.NativeImage {
  return getAboutIcon().resize({ width: 16, height: 16 });
}

async function showAboutMessageBox(): Promise<void> {
  const locale = getCurrentLocale();
  const txt = menuText[locale];
  await dialog.showMessageBox({
    type: 'info',
    title: txt.aboutTitle,
    message: 'DevToolBox',
    icon: getAboutIcon(),
    detail: [`${txt.company}: Jacobs`, `${txt.developer}: Jacobs`, `${txt.version}: ${APP_VERSION}`, `${txt.build}: ${BUILD_NUMBER}`].join(
      '\n',
    ),
  });
}

function openAbout(): void {
  if (!mainWindow) {
    void showAboutMessageBox();
    return;
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('app:openAbout');
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const locale = getCurrentLocale();
  const txt = menuText[locale];
  const setting = getCurrentLocaleSetting();
  const themeSetting = getCurrentThemeSetting();

  const languageItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: txt.langAuto,
      type: 'radio' as const,
      checked: setting === 'auto',
      click: () => {
        setCurrentLocaleSetting('auto');
        broadcastLocaleChange(getCurrentLocale());
        buildMenu();
      },
    },
    {
      label: txt.langEn,
      type: 'radio' as const,
      checked: setting === 'en',
      click: () => {
        setCurrentLocaleSetting('en');
        broadcastLocaleChange(getCurrentLocale());
        buildMenu();
      },
    },
    {
      label: txt.langZhCN,
      type: 'radio' as const,
      checked: setting === 'zh-CN',
      click: () => {
        setCurrentLocaleSetting('zh-CN');
        broadcastLocaleChange(getCurrentLocale());
        buildMenu();
      },
    },
  ];

  const themeItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: txt.themeAuto,
      type: 'radio' as const,
      checked: themeSetting === 'auto',
      click: () => {
        setCurrentThemeSetting('auto');
        broadcastThemeChange(getCurrentTheme());
        buildMenu();
      },
    },
    {
      label: txt.themeDark,
      type: 'radio' as const,
      checked: themeSetting === 'dark',
      click: () => {
        setCurrentThemeSetting('dark');
        broadcastThemeChange(getCurrentTheme());
        buildMenu();
      },
    },
    {
      label: txt.themeLight,
      type: 'radio' as const,
      checked: themeSetting === 'light',
      click: () => {
        setCurrentThemeSetting('light');
        broadcastThemeChange(getCurrentTheme());
        buildMenu();
      },
    },
  ];

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: txt.aboutTitle,
                click: () => {
                  openAbout();
                },
              },
              { type: 'separator' as const },
              {
                label: txt.settings,
                accelerator: 'CommandOrControl+,',
                click: () => {
                  if (!mainWindow) return;
                  mainWindow.show();
                  mainWindow.focus();
                  mainWindow.webContents.send('app:openSettings');
                },
              },
              {
                label: txt.exportData,
                click: () => {
                  if (!mainWindow) return;
                  mainWindow.show();
                  mainWindow.focus();
                  mainWindow.webContents.send('app:openExport');
                },
              },
              {
                label: txt.importData,
                click: () => {
                  if (!mainWindow) return;
                  mainWindow.show();
                  mainWindow.focus();
                  mainWindow.webContents.send('app:openImport');
                },
              },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    isMac
      ? {
          label: 'Edit',
          submenu: [
            { role: 'undo' as const },
            { role: 'redo' as const },
            { type: 'separator' as const },
            { role: 'cut' as const },
            { role: 'copy' as const },
            { role: 'paste' as const },
            { role: 'pasteAndMatchStyle' as const },
            { role: 'delete' as const },
            { role: 'selectAll' as const },
          ],
        }
      : ({ role: 'editMenu' as const } as Electron.MenuItemConstructorOptions),
    {
      label: txt.view,
      submenu: [
        {
          label: txt.language,
          submenu: languageItems,
        },
        {
          label: txt.theme,
          submenu: themeItems,
        },
      ],
    },
    {
      label: txt.help,
      submenu: [
        {
          label: txt.checkUpdates,
          click: () => {
            void checkForUpdatesInteractive();
          },
        },
        { type: 'separator' as const },
        {
          label: txt.about,
          icon: getMenuIcon(),
          click: () => {
            openAbout();
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
  const win = new BrowserWindow({
    ...WINDOW_CONFIG,
    webPreferences: {
      ...WINDOW_CONFIG.webPreferences,
      webSecurity: !isDev,
      allowRunningInsecureContent: isDev,
    },
  });
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.setFullScreen(true);

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    try {
      const u = new URL(devUrl);
      u.hostname = 'localhost';
      void win.loadURL(u.toString());
    } catch {
      void win.loadURL(devUrl);
    }
  } else {
    void win.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

// Register framework-level IPC handlers
registerLocaleIpc((locale) => {
  void locale;
  broadcastLocaleChange(getCurrentLocale());
  buildMenu();
});
registerThemeIpc((theme) => {
  void theme;
  broadcastThemeChange(getCurrentTheme());
  buildMenu();
});
registerFileIpc();
registerAppIpc(APP_VERSION, BUILD_NUMBER);
registerMarketplaceIpc();
registerBackupIpc();

// Auto-register all module-level IPC (dedupe: each register function is called only once)
const registeredIpc = new Set<() => void>();
for (const [, mod] of Object.entries(moduleIpcFiles)) {
  const registerFn = mod.register;
  if (typeof registerFn === 'function' && !registeredIpc.has(registerFn as () => void)) {
    const fn = registerFn as () => void;
    registeredIpc.add(fn);
    fn();
  }
}

app.on('ready', () => {
  buildMenu();
  createWindow();
  registerHttpIpc();
  initUpdater(() => mainWindow);
});

app.on('before-quit', (e) => {
  if (flushingStorage) return;
  const win = mainWindow;
  if (!win) return;
  const s = win.webContents.session as unknown as { flushStorageData?: () => Promise<void> };
  if (typeof s.flushStorageData !== 'function') return;
  flushingStorage = true;
  e.preventDefault();
  void Promise.resolve()
    .then(() => s.flushStorageData?.())
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
