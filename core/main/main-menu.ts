import { app, Menu, dialog, nativeImage, type BrowserWindow } from 'electron';
import { checkForUpdatesInteractive } from './updater';
import {
  broadcastLocaleChange,
  getCurrentLocale,
  getCurrentLocaleSetting,
  setCurrentLocaleSetting,
} from './ipc/locale';
import {
  broadcastThemeChange,
  getCurrentTheme,
  getCurrentThemeSetting,
  setCurrentThemeSetting,
} from './ipc/theme';

type Locale = ReturnType<typeof getCurrentLocale>;

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

export type MainMenuOptions = {
  appVersion: string;
  buildNumber: string;
  getMainWindow: () => BrowserWindow | null;
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

function focusAndSend(getMainWindow: () => BrowserWindow | null, channel: string): void {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send(channel);
}

async function showAboutMessageBox(options: MainMenuOptions): Promise<void> {
  const locale = getCurrentLocale();
  const txt = menuText[locale];
  await dialog.showMessageBox({
    type: 'info',
    title: txt.aboutTitle,
    message: 'DevToolBox',
    icon: getAboutIcon(),
    detail: [
      `${txt.company}: Jacobs`,
      `${txt.developer}: Jacobs`,
      `${txt.version}: ${options.appVersion}`,
      `${txt.build}: ${options.buildNumber}`,
    ].join('\n'),
  });
}

function openAbout(options: MainMenuOptions): void {
  const mainWindow = options.getMainWindow();
  if (!mainWindow) {
    void showAboutMessageBox(options);
    return;
  }
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('app:openAbout');
}

export function buildMainMenu(options: MainMenuOptions): void {
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
        buildMainMenu(options);
      },
    },
    {
      label: txt.langEn,
      type: 'radio' as const,
      checked: setting === 'en',
      click: () => {
        setCurrentLocaleSetting('en');
        broadcastLocaleChange(getCurrentLocale());
        buildMainMenu(options);
      },
    },
    {
      label: txt.langZhCN,
      type: 'radio' as const,
      checked: setting === 'zh-CN',
      click: () => {
        setCurrentLocaleSetting('zh-CN');
        broadcastLocaleChange(getCurrentLocale());
        buildMainMenu(options);
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
        buildMainMenu(options);
      },
    },
    {
      label: txt.themeDark,
      type: 'radio' as const,
      checked: themeSetting === 'dark',
      click: () => {
        setCurrentThemeSetting('dark');
        broadcastThemeChange(getCurrentTheme());
        buildMainMenu(options);
      },
    },
    {
      label: txt.themeLight,
      type: 'radio' as const,
      checked: themeSetting === 'light',
      click: () => {
        setCurrentThemeSetting('light');
        broadcastThemeChange(getCurrentTheme());
        buildMainMenu(options);
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
                click: () => openAbout(options),
              },
              { type: 'separator' as const },
              {
                label: txt.settings,
                accelerator: 'CommandOrControl+,',
                click: () => focusAndSend(options.getMainWindow, 'app:openSettings'),
              },
              {
                label: txt.exportData,
                click: () => focusAndSend(options.getMainWindow, 'app:openExport'),
              },
              {
                label: txt.importData,
                click: () => focusAndSend(options.getMainWindow, 'app:openImport'),
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
      : { role: 'editMenu' as const },
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
          click: () => openAbout(options),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
