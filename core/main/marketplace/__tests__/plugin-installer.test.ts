import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketplacePluginManifest, MarketplaceRegistryEntry } from '@devtoolbox/core';
import { PluginInstaller, validateExtractedPluginTree } from '../plugin-installer';
import { PluginRepository, type MarketplaceState, type MarketplaceStateStore } from '../plugin-repository';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-installer-'));
  tempDirs.push(dir);
  return dir;
}

function createRepository(): PluginRepository {
  const store: MarketplaceStateStore & { value: MarketplaceState } = {
    value: { installed: {} },
    read() {
      return this.value;
    },
    write(state) {
      this.value = state;
    },
  };
  return new PluginRepository(store);
}

function createEntry(root: string, version: string, status?: MarketplaceRegistryEntry['status']) {
  const bytes = Buffer.from(`archive-${version}`);
  const sourcePath = path.join(root, `${version}.zip`);
  fs.writeFileSync(sourcePath, bytes);
  const manifest: MarketplacePluginManifest = {
    id: 'market-example-tool',
    name: 'Example',
    description: 'Example plugin',
    version,
    sdkVersion: '1.0',
    entry: 'package/index.html',
    categoryId: 'dev-tools',
    author: 'DevToolBox',
    license: 'Apache-2.0',
    homepage: 'https://example.com',
    repository: 'https://example.com/repository',
    permissions: ['storage:kv'],
  };
  return {
    manifest,
    downloadUrl: pathToFileURL(sourcePath).toString(),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
    status,
  } satisfies MarketplaceRegistryEntry;
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries: { name: string; content: string }[]): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.content);
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localChunks.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralChunks.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralSize = centralChunks.reduce((total, chunk) => total + chunk.length, 0);
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(entries.length, 8);
  endHeader.writeUInt16LE(entries.length, 10);
  endHeader.writeUInt32LE(centralSize, 12);
  endHeader.writeUInt32LE(offset, 16);
  endHeader.writeUInt16LE(0, 20);
  return Buffer.concat([...localChunks, ...centralChunks, endHeader]);
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('PluginInstaller', () => {
  it('installs through a staging directory and preserves enabled state across upgrades', async () => {
    const root = tempDir();
    const repository = createRepository();
    let currentManifest: MarketplacePluginManifest;
    const extractArchive = vi.fn((_zipPath: string, targetDir: string) => {
      fs.mkdirSync(path.join(targetDir, 'package'), { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(currentManifest));
      fs.writeFileSync(path.join(targetDir, 'package', 'index.html'), '<!doctype html>');
      return Promise.resolve();
    });
    const installer = new PluginInstaller({
      repository,
      installBaseDir: path.join(root, 'modules'),
      zipCacheDir: path.join(root, 'cache'),
      tempDir: path.join(root, 'temp'),
      pluginDataBaseDir: path.join(root, 'data'),
      isDevelopment: true,
      userAgent: 'test',
      extractArchive,
      now: () => Date.parse('2026-01-01T00:00:00.000Z'),
    });

    const first = createEntry(root, '1.0.0');
    currentManifest = first.manifest;
    await expect(installer.install(first)).resolves.toEqual({
      success: true,
      provenance: { status: 'unsigned' },
    });
    expect(repository.get(first.manifest.id)).toMatchObject({
      version: '1.0.0',
      enabled: true,
      provenance: { status: 'unsigned' },
    });
    repository.setEnabled(first.manifest.id, false);

    const second = createEntry(root, '2.0.0');
    currentManifest = second.manifest;
    await expect(installer.install(second)).resolves.toEqual({
      success: true,
      provenance: { status: 'unsigned' },
    });
    expect(repository.get(second.manifest.id)).toMatchObject({ version: '2.0.0', enabled: false });
    expect(fs.existsSync(path.join(root, 'modules', second.manifest.id, '1.0.0'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'modules', second.manifest.id, '2.0.0'))).toBe(true);
  });

  it('rejects blocked plugins and archive integrity mismatches before extraction', async () => {
    const root = tempDir();
    const repository = createRepository();
    const extractArchive = vi.fn();
    const installer = new PluginInstaller({
      repository,
      installBaseDir: path.join(root, 'modules'),
      zipCacheDir: path.join(root, 'cache'),
      tempDir: path.join(root, 'temp'),
      pluginDataBaseDir: path.join(root, 'data'),
      isDevelopment: true,
      userAgent: 'test',
      extractArchive,
    });

    await expect(installer.install(createEntry(root, '1.0.0', 'blocked'))).resolves.toEqual({
      success: false,
      error: 'Plugin is blocked',
    });
    const invalid = createEntry(root, '2.0.0');
    invalid.sha256 = '0'.repeat(64);
    await expect(installer.install(invalid)).resolves.toMatchObject({ success: false });
    expect(extractArchive).not.toHaveBeenCalled();
    expect(repository.list()).toEqual([]);
  });

  it('downloads HTTPS packages with bounded policy and validates the cached archive', async () => {
    const root = tempDir();
    const archive = Buffer.from('remote archive');
    const entry = createEntry(root, '1.0.0');
    entry.downloadUrl = 'https://cdn.example.com/market-example-tool.zip';
    entry.sha256 = crypto.createHash('sha256').update(archive).digest('hex');
    entry.size = archive.length;
    const request = vi.fn().mockResolvedValue({
      status: 200,
      headers: {},
      data: archive.toString('base64'),
    });
    const extractArchive = vi.fn((_zipPath: string, targetDir: string) => {
      fs.mkdirSync(path.join(targetDir, 'package'), { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(entry.manifest));
      fs.writeFileSync(path.join(targetDir, 'package', 'index.html'), '<!doctype html>');
      return Promise.resolve();
    });
    const installer = new PluginInstaller({
      repository: createRepository(),
      installBaseDir: path.join(root, 'modules'),
      zipCacheDir: path.join(root, 'cache'),
      tempDir: path.join(root, 'temp'),
      pluginDataBaseDir: path.join(root, 'data'),
      isDevelopment: false,
      userAgent: 'DevToolBox Test',
      request,
      extractArchive,
    });

    await expect(installer.install(entry)).resolves.toEqual({
      success: true,
      provenance: { status: 'unsigned' },
    });
    expect(request).toHaveBeenCalledWith(
      {
        url: entry.downloadUrl,
        timeoutMs: 30_000,
        responseType: 'arrayBuffer',
        headers: {
          'user-agent': 'DevToolBox Test',
          accept: 'application/octet-stream, */*',
        },
      },
      { maxBytes: 100 * 1024 * 1024 },
    );
    expect(fs.readFileSync(path.join(root, 'cache', `${entry.sha256}.zip`))).toEqual(archive);
  });

  it('rejects forbidden HTTPS download host literals before network access', async () => {
    const root = tempDir();
    const entry = createEntry(root, '1.0.0');
    entry.downloadUrl = 'https://127.0.0.1/plugin.zip';
    const request = vi.fn();
    const extractArchive = vi.fn();
    const installer = new PluginInstaller({
      repository: createRepository(),
      installBaseDir: path.join(root, 'modules'),
      zipCacheDir: path.join(root, 'cache'),
      tempDir: path.join(root, 'temp'),
      pluginDataBaseDir: path.join(root, 'data'),
      isDevelopment: false,
      userAgent: 'test',
      request,
      extractArchive,
    });

    await expect(installer.install(entry)).resolves.toEqual({
      success: false,
      error: 'Forbidden download host',
    });
    expect(request).not.toHaveBeenCalled();
    expect(extractArchive).not.toHaveBeenCalled();
  });

  it('rejects symbolic links in extracted packages', () => {
    const root = tempDir();
    const outside = path.join(root, 'outside.txt');
    const packageDir = path.join(root, 'package');
    fs.mkdirSync(packageDir);
    fs.writeFileSync(outside, 'outside');
    fs.symlinkSync(outside, path.join(packageDir, 'link.txt'));
    expect(validateExtractedPluginTree(packageDir)).toBe('Package must not contain symbolic links');
  });

  it('rejects zip path traversal entries before activating a plugin', async () => {
    const root = tempDir();
    const repository = createRepository();
    const entry = createEntry(root, '1.0.0');
    const archive = createStoredZip([
      { name: '../evil.txt', content: 'evil' },
      { name: 'manifest.json', content: JSON.stringify(entry.manifest) },
      { name: 'package/index.html', content: '<!doctype html>' },
    ]);
    const archivePath = path.join(root, 'malicious.zip');
    fs.writeFileSync(archivePath, archive);
    entry.downloadUrl = pathToFileURL(archivePath).toString();
    entry.sha256 = crypto.createHash('sha256').update(archive).digest('hex');
    entry.size = archive.length;
    const installer = new PluginInstaller({
      repository,
      installBaseDir: path.join(root, 'modules'),
      zipCacheDir: path.join(root, 'cache'),
      tempDir: path.join(root, 'temp'),
      pluginDataBaseDir: path.join(root, 'data'),
      isDevelopment: true,
      userAgent: 'test',
    });

    const result = await installer.install(entry);
    expect(result).toMatchObject({ success: false });
    if (!result.success) expect(result.error).toContain('invalid relative path');
    expect(repository.list()).toEqual([]);
    expect(fs.existsSync(path.join(root, 'modules', entry.manifest.id, 'evil.txt'))).toBe(false);
  });

  it('rejects unsigned packages before extraction when strict provenance is enabled', async () => {
    const root = tempDir();
    const extractArchive = vi.fn();
    const installer = new PluginInstaller({
      repository: createRepository(),
      installBaseDir: path.join(root, 'modules'),
      zipCacheDir: path.join(root, 'cache'),
      tempDir: path.join(root, 'temp'),
      pluginDataBaseDir: path.join(root, 'data'),
      isDevelopment: true,
      userAgent: 'test',
      extractArchive,
      provenancePolicy: { mode: 'strict', publishers: [] },
    });

    await expect(installer.install(createEntry(root, '1.0.0'))).resolves.toEqual({
      success: false,
      error: 'A trusted package signature is required',
    });
    expect(extractArchive).not.toHaveBeenCalled();
  });

  it('restores the active version when persisting the replacement fails', async () => {
    const root = tempDir();
    const entry = createEntry(root, '1.0.0');
    const record = {
      id: entry.manifest.id,
      version: entry.manifest.version,
      enabled: true,
      installedAt: '2025-01-01T00:00:00.000Z',
      manifest: entry.manifest,
    };
    const store: MarketplaceStateStore = {
      read: () => ({ installed: { [record.id]: record } }),
      write: () => {
        throw new Error('state write failed');
      },
    };
    const repository = new PluginRepository(store);
    const targetDir = path.join(root, 'modules', record.id, record.version);
    fs.mkdirSync(path.join(targetDir, 'package'), { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(record.manifest));
    fs.writeFileSync(path.join(targetDir, 'package', 'index.html'), 'old version');
    const installer = new PluginInstaller({
      repository,
      installBaseDir: path.join(root, 'modules'),
      zipCacheDir: path.join(root, 'cache'),
      tempDir: path.join(root, 'temp'),
      pluginDataBaseDir: path.join(root, 'data'),
      isDevelopment: true,
      userAgent: 'test',
      extractArchive: (_zipPath, stagingDir) => {
        fs.mkdirSync(path.join(stagingDir, 'package'), { recursive: true });
        fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(record.manifest));
        fs.writeFileSync(path.join(stagingDir, 'package', 'index.html'), 'new version');
        return Promise.resolve();
      },
    });

    await expect(installer.install(entry)).resolves.toEqual({ success: false, error: 'state write failed' });
    expect(fs.readFileSync(path.join(targetDir, 'package', 'index.html'), 'utf8')).toBe('old version');
  });

  it('serializes concurrent operations for the same plugin', async () => {
    const root = tempDir();
    const repository = createRepository();
    const entry = createEntry(root, '1.0.0');
    let calls = 0;
    let releaseFirst: (() => void) | undefined;
    const installer = new PluginInstaller({
      repository,
      installBaseDir: path.join(root, 'modules'),
      zipCacheDir: path.join(root, 'cache'),
      tempDir: path.join(root, 'temp'),
      pluginDataBaseDir: path.join(root, 'data'),
      isDevelopment: true,
      userAgent: 'test',
      extractArchive: (_zipPath, stagingDir) => {
        calls += 1;
        fs.mkdirSync(path.join(stagingDir, 'package'), { recursive: true });
        fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(entry.manifest));
        fs.writeFileSync(path.join(stagingDir, 'package', 'index.html'), `install ${calls}`);
        if (calls !== 1) return Promise.resolve();
        return new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
      },
    });

    const first = installer.install(entry);
    const second = installer.install(entry);
    await vi.waitFor(() => expect(calls).toBe(1));
    releaseFirst?.();
    await expect(Promise.all([first, second])).resolves.toEqual([
      { success: true, provenance: { status: 'unsigned' } },
      { success: true, provenance: { status: 'unsigned' } },
    ]);
    expect(calls).toBe(2);
  });
});
