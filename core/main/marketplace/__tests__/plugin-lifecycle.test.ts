import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketplacePluginManifest, MarketplaceRegistry } from '@devtoolbox/core';
import { PluginCapabilityBroker, type CapabilityKvStore } from '../capability-broker';
import { PluginInstaller } from '../plugin-installer';
import { PluginRepository, type MarketplaceState, type MarketplaceStateStore } from '../plugin-repository';
import { fetchMarketplaceRegistry } from '../registry-client';
import { PluginTokenStore } from '../token-store';
import { pluginEntryUrl } from '../../protocols/plugin-protocol';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-lifecycle-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('Marketplace plugin lifecycle', () => {
  it('validates, installs, authorizes, disables, and uninstalls a plugin', async () => {
    const root = tempDir();
    const archive = Buffer.from('lifecycle archive');
    const archivePath = path.join(root, 'plugin.zip');
    fs.writeFileSync(archivePath, archive);
    const manifest: MarketplacePluginManifest = {
      id: 'market-lifecycle-test',
      name: 'Lifecycle Test',
      description: 'Integration fixture',
      version: '1.0.0',
      sdkVersion: '1.0',
      entry: 'package/index.html',
      categoryId: 'dev-tools',
      author: 'DevToolBox',
      license: 'Apache-2.0',
      homepage: 'https://example.com',
      repository: 'https://example.com/repository',
      permissions: ['storage:kv', 'fs:dialog', 'fs:read'],
    };
    const registry: MarketplaceRegistry = {
      schemaVersion: 1,
      plugins: [
        {
          manifest,
          downloadUrl: pathToFileURL(archivePath).toString(),
          sha256: crypto.createHash('sha256').update(archive).digest('hex'),
          size: archive.length,
          status: 'active',
        },
      ],
    };
    const registryPath = path.join(root, 'registry.json');
    fs.writeFileSync(registryPath, JSON.stringify(registry));
    const fetched = await fetchMarketplaceRegistry(pathToFileURL(registryPath).toString(), {
      cacheDir: path.join(root, 'registry-cache'),
      isDevelopment: true,
      userAgent: 'test',
    });
    expect(fetched).toMatchObject({
      success: true,
      registry: {
        schemaVersion: 1,
        plugins: [{ manifest: { id: manifest.id }, sha256: registry.plugins[0].sha256 }],
      },
    });
    if (!fetched.success) return;

    const stateStore: MarketplaceStateStore & { value: MarketplaceState } = {
      value: { installed: {} },
      read() {
        return this.value;
      },
      write(state) {
        this.value = state;
      },
    };
    const repository = new PluginRepository(stateStore);
    const fileTokens = new PluginTokenStore();
    const kv = { schemaVersion: 1 as const, plugins: {} as Record<string, Record<string, unknown>> };
    const kvStore: CapabilityKvStore = {
      read: () => kv,
      write: (value) => {
        kv.plugins = value.plugins;
      },
      migrateLegacy: vi.fn(),
    };
    const installer = new PluginInstaller({
      repository,
      installBaseDir: path.join(root, 'modules'),
      zipCacheDir: path.join(root, 'zip-cache'),
      tempDir: path.join(root, 'temp'),
      pluginDataBaseDir: path.join(root, 'plugin-data'),
      isDevelopment: true,
      userAgent: 'test',
      clearFileTokens: (pluginId) => fileTokens.clear(pluginId),
      clearPluginData: (pluginId) => {
        delete kv.plugins[pluginId];
      },
      extractArchive: (_zipPath, targetDir) => {
        fs.mkdirSync(path.join(targetDir, 'package'), { recursive: true });
        fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest));
        fs.writeFileSync(path.join(targetDir, 'package', 'index.html'), '<!doctype html>');
        return Promise.resolve();
      },
    });
    await expect(installer.install(fetched.registry.plugins[0])).resolves.toEqual({
      success: true,
      provenance: { status: 'unsigned' },
    });
    const installed = repository.get(manifest.id);
    expect(installed).toMatchObject({ id: manifest.id, version: '1.0.0', enabled: true });
    expect(pluginEntryUrl(manifest)).toBe(
      'devtoolbox-plugin://market-lifecycle-test/1.0.0/package/index.html',
    );

    const selectedPath = path.join(root, 'selected.txt');
    fs.writeFileSync(selectedPath, 'selected content');
    const broker = new PluginCapabilityBroker({
      repository,
      fileTokens,
      kvStore,
      platform: {
        openFiles: vi.fn().mockResolvedValue([selectedPath]),
        saveFile: vi.fn().mockResolvedValue(undefined),
        openExternal: vi.fn().mockResolvedValue(undefined),
        revealPath: vi.fn(),
        openPath: vi.fn().mockResolvedValue(undefined),
        notify: vi.fn().mockReturnValue(true),
      },
    });
    expect(broker.storageSet(manifest.id, 'setting', { compact: true })).toEqual({ ok: true, data: true });
    const selected = await broker.fsOpenFileDialog({}, manifest.id, {});
    expect(selected).toMatchObject({ ok: true, data: { items: [{ name: 'selected.txt' }] } });
    if (!selected.ok) return;
    const token = (selected.data as { items: { fileToken: string }[] }).items[0].fileToken;
    expect(broker.fsReadFile(manifest.id, token, 'utf8')).toEqual({
      ok: true,
      data: { content: 'selected content' },
    });

    repository.setEnabled(manifest.id, false);
    expect(broker.storageGet(manifest.id, 'setting')).toMatchObject({
      ok: false,
      error: { code: 'plugin_disabled' },
    });
    repository.setEnabled(manifest.id, true);
    await expect(installer.uninstall(manifest.id)).resolves.toEqual({ success: true });
    expect(repository.get(manifest.id)).toBeUndefined();
    expect(fileTokens.resolve(manifest.id, token)).toBeUndefined();
    expect(kv.plugins[manifest.id]).toBeUndefined();
    expect(broker.storageGet(manifest.id, 'setting')).toMatchObject({
      ok: false,
      error: { code: 'not_installed' },
    });
  });
});
