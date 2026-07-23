import {
  BrowserWindow,
  Notification,
  dialog,
  ipcMain,
  shell,
  type OpenDialogOptions,
  type SaveDialogOptions,
  type WebContents,
} from 'electron';
import type { CapabilityPlatform, PluginCapabilityBroker } from '../marketplace/capability-broker';

function ownerWindow(owner: unknown): BrowserWindow | null {
  return owner ? BrowserWindow.fromWebContents(owner as WebContents) : null;
}

export function createElectronCapabilityPlatform(): CapabilityPlatform {
  return {
    async openFiles(owner, options) {
      const dialogOptions: OpenDialogOptions = {
        title: 'Open File',
        filters: options.filters,
        properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      };
      const win = ownerWindow(owner);
      const result = win
        ? await dialog.showOpenDialog(win, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);
      return result.canceled || !result.filePaths.length ? undefined : result.filePaths;
    },
    async saveFile(owner, options) {
      const dialogOptions: SaveDialogOptions = {
        title: 'Save File',
        defaultPath: options.suggestedName,
        filters: options.filters,
      };
      const win = ownerWindow(owner);
      const result = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions);
      return result.canceled ? undefined : result.filePath;
    },
    openExternal: (url) => shell.openExternal(url),
    revealPath: (filePath) => shell.showItemInFolder(filePath),
    async openPath(filePath) {
      const error = await shell.openPath(filePath);
      if (error) throw new Error(error);
    },
    notify(title, body) {
      if (!Notification.isSupported()) return false;
      new Notification({ title, body }).show();
      return true;
    },
  };
}

export function registerPluginCapabilityIpc(broker: PluginCapabilityBroker): void {
  ipcMain.handle('plugin:log', (_event, pluginId: unknown, params: unknown) => broker.log(pluginId, params));
  ipcMain.handle('plugin:httpRequest', (_event, pluginId: unknown, params: unknown) =>
    broker.httpRequest(pluginId, params),
  );
  ipcMain.handle('plugin:storageGet', (_event, pluginId: unknown, key: unknown) =>
    broker.storageGet(pluginId, key),
  );
  ipcMain.handle('plugin:storageSet', (_event, pluginId: unknown, key: unknown, value: unknown) =>
    broker.storageSet(pluginId, key, value),
  );
  ipcMain.handle('plugin:storageDelete', (_event, pluginId: unknown, key: unknown) =>
    broker.storageDelete(pluginId, key),
  );
  ipcMain.handle('plugin:storageList', (_event, pluginId: unknown, prefix: unknown) =>
    broker.storageList(pluginId, prefix),
  );
  ipcMain.handle('plugin:storageClear', (_event, pluginId: unknown) => broker.storageClear(pluginId));
  ipcMain.handle('plugin:fsOpenFileDialog', (event, pluginId: unknown, params: unknown) =>
    broker.fsOpenFileDialog(event.sender, pluginId, params),
  );
  ipcMain.handle('plugin:fsSaveFileDialog', (event, pluginId: unknown, params: unknown) =>
    broker.fsSaveFileDialog(event.sender, pluginId, params),
  );
  ipcMain.handle('plugin:fsReadFile', (_event, pluginId: unknown, fileToken: unknown, encoding: unknown) =>
    broker.fsReadFile(pluginId, fileToken, encoding),
  );
  ipcMain.handle(
    'plugin:fsWriteFile',
    (_event, pluginId: unknown, fileToken: unknown, content: unknown, encoding: unknown) =>
      broker.fsWriteFile(pluginId, fileToken, content, encoding),
  );
  ipcMain.handle('plugin:systemOpenExternal', (_event, pluginId: unknown, url: unknown) =>
    broker.systemOpenExternal(pluginId, url),
  );
  ipcMain.handle('plugin:systemRevealPath', (_event, pluginId: unknown, token: unknown) =>
    broker.systemRevealPath(pluginId, token),
  );
  ipcMain.handle('plugin:systemOpenPath', (_event, pluginId: unknown, token: unknown) =>
    broker.systemOpenPath(pluginId, token),
  );
  ipcMain.handle('plugin:systemNotify', (_event, pluginId: unknown, params: unknown) =>
    broker.systemNotify(pluginId, params),
  );
  ipcMain.handle('plugin:systemGetInfo', (_event, pluginId: unknown) => broker.systemGetInfo(pluginId));
  ipcMain.handle('plugin:systemGetEnv', (_event, pluginId: unknown, keys: unknown) =>
    broker.systemGetEnv(pluginId, keys),
  );
}
