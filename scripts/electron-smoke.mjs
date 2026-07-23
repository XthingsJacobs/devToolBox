import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';

const preloadPath = path.resolve(process.cwd(), 'dist-electron/preload/index.js');
if (!fs.existsSync(preloadPath)) {
  process.stderr.write('Electron smoke test requires pnpm build first.\n');
  process.exit(1);
}

app.commandLine.appendSwitch('disable-gpu');
if (process.env.CI) app.commandLine.appendSwitch('no-sandbox');

let localeSetting = 'auto';
ipcMain.handle('app:getLocale', () => ({
  setting: localeSetting,
  locale: localeSetting === 'zh-CN' ? 'zh-CN' : 'en',
}));
ipcMain.handle('app:setLocale', (_event, setting) => {
  localeSetting = setting;
});

const deadline = setTimeout(() => {
  process.stderr.write('Electron smoke test timed out.\n');
  app.exit(1);
}, 15_000);

app.whenReady().then(async () => {
  try {
    const window = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: preloadPath,
      },
    });
    await window.loadURL('data:text/html;charset=utf-8,<main id="root">smoke</main>');
    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const api = window.electronAPI;
        if (!api) throw new Error('electronAPI is unavailable');
        const before = await api.getLocale();
        await api.setLocale('zh-CN');
        const after = await api.getLocale();
        return {
          before,
          after,
          hasMarketplace: typeof api.marketplaceInstall === 'function',
          hasPluginSdk: typeof api.pluginStorageGet === 'function',
          hasDiagnostics:
            typeof api.diagnosticsRecord === 'function' &&
            typeof api.diagnosticsList === 'function' &&
            typeof api.diagnosticsExport === 'function',
          hasStartupRecovery:
            typeof api.startupGetStatus === 'function' &&
            typeof api.startupRendererReady === 'function' &&
            typeof api.startupRestart === 'function'
        };
      })()
    `);
    if (
      result.before?.setting !== 'auto' ||
      result.after?.setting !== 'zh-CN' ||
      result.after?.locale !== 'zh-CN' ||
      !result.hasMarketplace ||
      !result.hasPluginSdk ||
      !result.hasDiagnostics ||
      !result.hasStartupRecovery
    ) {
      throw new Error(`Unexpected preload result: ${JSON.stringify(result)}`);
    }
    clearTimeout(deadline);
    process.stdout.write('Electron preload IPC smoke test passed.\n');
    window.destroy();
    app.exit(0);
  } catch (error) {
    clearTimeout(deadline);
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    app.exit(1);
  }
});
