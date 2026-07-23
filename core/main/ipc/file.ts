import { ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { validateFileFilters } from './validation';

export function register(): void {
  // IPC: open file (show dialog, return file path and content)
  ipcMain.handle('file:open', async (_event, filters: unknown, encoding: unknown) => {
    const validatedFilters = validateFileFilters(filters);
    if (!validatedFilters.ok) return null;
    if (encoding !== undefined && encoding !== 'utf8' && encoding !== 'utf-8' && encoding !== 'base64') {
      return null;
    }
    const defaultFilters = validatedFilters.data || [{ name: 'All Files', extensions: ['*'] }];
    const result = await dialog.showOpenDialog({
      title: 'Open File',
      filters: defaultFilters,
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const filePath = result.filePaths[0];
    try {
      const enc = encoding ?? 'utf-8';
      const content =
        enc === 'base64' ? fs.readFileSync(filePath).toString('base64') : fs.readFileSync(filePath, 'utf-8');
      return { filePath, content };
    } catch {
      return null;
    }
  });

  // IPC: save file (overwrite)
  ipcMain.handle('file:save', (_event, filePath: unknown, content: unknown) => {
    if (typeof filePath !== 'string' || !filePath || typeof content !== 'string') return false;
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  // IPC: save as (show dialog)
  ipcMain.handle('file:saveAs', async (_event, defaultName: unknown, content: unknown, filters: unknown) => {
    if (typeof defaultName !== 'string' || !defaultName || typeof content !== 'string') return null;
    const validatedFilters = validateFileFilters(filters);
    if (!validatedFilters.ok) return null;
    const defaultFilters = validatedFilters.data || [{ name: 'All Files', extensions: ['*'] }];
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
  });

  // IPC: confirm overwrite dialog
  ipcMain.handle('file:confirmOverwrite', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !filePath) return false;
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
