import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appGetPath: vi.fn(() => '/tmp/devtoolbox-backup-test'),
  appGetVersion: vi.fn(() => '2.0.3'),
  ipcHandle: vi.fn(),
  showSaveDialog: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: mocks.appGetPath,
    getVersion: mocks.appGetVersion,
  },
  dialog: {
    showSaveDialog: mocks.showSaveDialog,
  },
  ipcMain: {
    handle: mocks.ipcHandle,
  },
}));

import { register } from '../backup';

type IpcHandler = (_event: unknown, input: unknown) => Promise<unknown>;

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-backup-'));
  tempDirs.push(dir);
  return dir;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
}

function pluginKvPath(root: string): string {
  return path.join(root, 'plugin-kv.json');
}

function marketplaceStatePath(root: string): string {
  return path.join(root, 'marketplace-state.json');
}

function installHandlers(): { exportBackup: IpcHandler; importBackup: IpcHandler } {
  register();
  const handlers = new Map<string, IpcHandler>();
  for (const [channel, handler] of mocks.ipcHandle.mock.calls) {
    handlers.set(channel, handler as IpcHandler);
  }
  const exportBackup = handlers.get('backup:export');
  const importBackup = handlers.get('backup:import');
  if (!exportBackup || !importBackup) throw new Error('Backup IPC handlers were not registered');
  return { exportBackup, importBackup };
}

beforeEach(() => {
  mocks.appGetPath.mockReturnValue('/tmp/devtoolbox-backup-test');
  mocks.appGetVersion.mockReturnValue('2.0.3');
  mocks.ipcHandle.mockReset();
  mocks.showSaveDialog.mockReset();
});

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('backup IPC', () => {
  it('requires the correct password and leaves existing state untouched after failed imports', async () => {
    const root = tempDir();
    const { exportBackup, importBackup } = installHandlers();
    const backupPath = path.join(root, 'backup.dtbx');
    const exportedKv = { schemaVersion: 1, plugins: { 'market-example': { setting: 'exported' } } };
    const exportedMarketplace = { installed: { 'market-example': { enabled: true } } };
    const existingKv = { schemaVersion: 1, plugins: { 'market-existing': { setting: 'keep' } } };
    const existingMarketplace = { installed: { 'market-existing': { enabled: false } } };

    mocks.appGetPath.mockReturnValue(root);
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: backupPath });
    writeJson(pluginKvPath(root), exportedKv);
    writeJson(marketplaceStatePath(root), exportedMarketplace);

    await expect(
      exportBackup(undefined, {
        bindToDevice: false,
        password: 'correct-password',
        localStorage: { devtoolbox_theme: 'light' },
      }),
    ).resolves.toEqual({ success: true, filePath: backupPath });
    const backupBase64 = fs.readFileSync(backupPath).toString('base64');

    writeJson(pluginKvPath(root), existingKv);
    writeJson(marketplaceStatePath(root), existingMarketplace);

    await expect(importBackup(undefined, { content: backupBase64, encoding: 'base64' })).resolves.toEqual({
      success: false,
      error: 'password_required',
    });
    await expect(
      importBackup(undefined, {
        content: backupBase64,
        encoding: 'base64',
        password: 'wrong-password',
      }),
    ).resolves.toEqual({ success: false, error: 'decrypt_failed' });
    expect(readJson(pluginKvPath(root))).toEqual(existingKv);
    expect(readJson(marketplaceStatePath(root))).toEqual(existingMarketplace);

    await expect(
      importBackup(undefined, {
        content: backupBase64,
        encoding: 'base64',
        password: 'correct-password',
      }),
    ).resolves.toEqual({ success: true, localStorage: { devtoolbox_theme: 'light' } });
    expect(readJson(pluginKvPath(root))).toEqual(exportedKv);
    expect(readJson(marketplaceStatePath(root))).toEqual(exportedMarketplace);
  });

  it('rejects device-bound backups on a different device profile without changing state', async () => {
    const sourceRoot = tempDir();
    const targetRoot = tempDir();
    const { exportBackup, importBackup } = installHandlers();
    const backupPath = path.join(sourceRoot, 'device-bound.dtbx');
    const targetKv = { schemaVersion: 1, plugins: { 'market-target': { setting: 'keep' } } };
    const targetMarketplace = { installed: { 'market-target': { enabled: true } } };

    mocks.appGetPath.mockReturnValue(sourceRoot);
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: backupPath });
    writeJson(pluginKvPath(sourceRoot), {
      schemaVersion: 1,
      plugins: { 'market-source': { setting: 'exported' } },
    });
    writeJson(marketplaceStatePath(sourceRoot), { installed: { 'market-source': { enabled: true } } });
    await expect(exportBackup(undefined, { bindToDevice: true })).resolves.toEqual({
      success: true,
      filePath: backupPath,
    });

    mocks.appGetPath.mockReturnValue(targetRoot);
    writeJson(pluginKvPath(targetRoot), targetKv);
    writeJson(marketplaceStatePath(targetRoot), targetMarketplace);

    await expect(
      importBackup(undefined, {
        content: fs.readFileSync(backupPath).toString('base64'),
        encoding: 'base64',
      }),
    ).resolves.toEqual({ success: false, error: 'decrypt_failed' });
    expect(readJson(pluginKvPath(targetRoot))).toEqual(targetKv);
    expect(readJson(marketplaceStatePath(targetRoot))).toEqual(targetMarketplace);
  });

  it('rolls back plugin state if marketplace state cannot be written', async () => {
    const root = tempDir();
    const { importBackup } = installHandlers();
    const existingKv = { schemaVersion: 1, plugins: { 'market-existing': { setting: 'keep' } } };
    const payload = {
      localStorage: { devtoolbox_theme: 'dark' },
      pluginKv: { schemaVersion: 1, plugins: { 'market-new': { setting: 'new' } } },
      marketplaceState: { installed: { 'market-new': { enabled: true } } },
    };
    const backup = {
      schemaVersion: 2,
      createdAt: '2026-07-20T00:00:00.000Z',
      app: { name: 'DevToolBox', version: '2.0.3' },
      encryption: { layers: [] },
      payload: { ciphertext: Buffer.from(JSON.stringify(payload)).toString('base64') },
    };

    mocks.appGetPath.mockReturnValue(root);
    writeJson(pluginKvPath(root), existingKv);
    fs.mkdirSync(marketplaceStatePath(root), { recursive: true });

    await expect(
      importBackup(undefined, { content: JSON.stringify(backup), encoding: 'utf8' }),
    ).resolves.toEqual({
      success: false,
      error: 'write_failed',
    });
    expect(readJson(pluginKvPath(root))).toEqual(existingKv);
    expect(fs.statSync(marketplaceStatePath(root)).isDirectory()).toBe(true);
  });
});
