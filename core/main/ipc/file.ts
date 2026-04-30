import { ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

export function register(): void {
  // IPC: open file (show dialog, return file path and content)
  ipcMain.handle('file:open', async (_event, filters?: { name: string; extensions: string[] }[], encoding?: string) => {
    const defaultFilters = filters || [{ name: 'All Files', extensions: ['*'] }];
    const result = await dialog.showOpenDialog({
      title: 'Open File',
      filters: defaultFilters,
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const filePath = result.filePaths[0];
    try {
      const enc = typeof encoding === 'string' ? encoding : 'utf-8';
      const content = enc === 'base64' ? fs.readFileSync(filePath).toString('base64') : fs.readFileSync(filePath, 'utf-8');
      return { filePath, content };
    } catch {
      return null;
    }
  });

  // IPC: save file (overwrite)
  ipcMain.handle('file:save', (_event, filePath: string, content: string) => {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  // IPC: save as (show dialog)
  ipcMain.handle(
    'file:saveAs',
    async (
      _event,
      defaultName: string,
      content: string,
      filters?: { name: string; extensions: string[] }[],
    ) => {
      const defaultFilters = filters || [{ name: 'All Files', extensions: ['*'] }];
      const result = await dialog.showSaveDialog({
        title: 'Save As',
        defaultPath: defaultName,
        filters: defaultFilters,
      });
      if (result.canceled || !result.filePath) return null;
      try {
        fs.writeFileSync(result.filePath, content, 'utf-8');
        return result.filePath;
      } catch {
        return null;
      }
    },
  );

  // IPC: confirm overwrite dialog
  ipcMain.handle('file:confirmOverwrite', async (_event, filePath: string) => {
    const fileName = path.basename(filePath);
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Confirm Save',
      message: `Saving will overwrite the existing file: ${fileName}`,
      detail: filePath,
      buttons: ['Cancel', 'Save'],
      defaultId: 1,
      cancelId: 0,
    });
    return result.response === 1;
  });
}
