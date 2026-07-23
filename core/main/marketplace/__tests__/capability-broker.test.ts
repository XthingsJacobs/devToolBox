import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MarketplacePluginManifest } from '@devtoolbox/core';
import {
  PluginCapabilityBroker,
  type CapabilityKvStore,
  type CapabilityPlatform,
} from '../capability-broker';
import { PluginRepository, type MarketplaceState, type MarketplaceStateStore } from '../plugin-repository';
import { PluginTokenStore } from '../token-store';

const tempDirs: string[] = [];

function createBroker(enabled = true, runtimeEnabled = true) {
  const manifest: MarketplacePluginManifest = {
    id: 'market-example-tool',
    name: 'Example',
    description: 'Example plugin',
    version: '1.0.0',
    sdkVersion: '1.0',
    entry: 'package/index.html',
    categoryId: 'dev-tools',
    author: 'DevToolBox',
    license: 'Apache-2.0',
    homepage: 'https://example.com',
    repository: 'https://example.com/repository',
    permissions: [
      'storage:kv',
      'http:proxy',
      'fs:dialog',
      'fs:read',
      'fs:write',
      'system:getInfo',
      'system:env:read',
    ],
    httpDomains: ['api.example.com'],
    envAllowlist: ['SAFE_VALUE'],
  };
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
  repository.save({
    id: manifest.id,
    version: manifest.version,
    enabled,
    installedAt: '2026-01-01T00:00:00.000Z',
    manifest,
  });
  const kv = { schemaVersion: 1 as const, plugins: {} as Record<string, Record<string, unknown>> };
  const kvStore: CapabilityKvStore = {
    read: () => kv,
    write: (value) => {
      kv.plugins = value.plugins;
    },
    migrateLegacy: vi.fn(),
  };
  const platform: CapabilityPlatform = {
    openFiles: vi.fn().mockResolvedValue(undefined),
    saveFile: vi.fn().mockResolvedValue(undefined),
    openExternal: vi.fn().mockResolvedValue(undefined),
    revealPath: vi.fn(),
    openPath: vi.fn().mockResolvedValue(undefined),
    notify: vi.fn().mockReturnValue(true),
  };
  const request = vi.fn().mockResolvedValue({ status: 200, headers: {}, data: 'ok' });
  const recordDiagnostic = vi.fn();
  const broker = new PluginCapabilityBroker({
    repository,
    fileTokens: new PluginTokenStore(),
    kvStore,
    platform,
    request,
    environment: { SAFE_VALUE: 'visible', SECRET_VALUE: 'hidden' },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
    recordDiagnostic,
    runtimeEnabled: () => runtimeEnabled,
  });
  return { broker, repository, manifest, kv, platform, request, recordDiagnostic };
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('PluginCapabilityBroker', () => {
  it('denies every capability for disabled plugins', () => {
    const { broker, manifest } = createBroker(false);
    expect(broker.storageGet(manifest.id, 'key')).toEqual({
      ok: false,
      error: { code: 'plugin_disabled', message: 'Plugin is disabled', details: undefined },
    });
  });

  it('denies every capability while the host is in safe mode', () => {
    const { broker, manifest } = createBroker(true, false);
    expect(broker.storageGet(manifest.id, 'key')).toEqual({
      ok: false,
      error: {
        code: 'safe_mode',
        message: 'Plugin capabilities are unavailable in safe mode',
        details: undefined,
      },
    });
  });

  it('validates storage keys and enforces a per-plugin quota', () => {
    const { broker, manifest } = createBroker();
    expect(broker.storageSet(manifest.id, '__proto__', true)).toMatchObject({
      ok: false,
      error: { code: 'invalid_params' },
    });
    expect(broker.storageSet(manifest.id, 'key', 'value')).toEqual({ ok: true, data: true });
    expect(broker.storageGet(manifest.id, 'key')).toEqual({ ok: true, data: 'value' });
    expect(broker.storageSet(manifest.id, 'large', 'x'.repeat(1024 * 1024))).toMatchObject({
      ok: false,
      error: { code: 'quota_exceeded' },
    });
  });

  it('validates HTTP requests and always applies the manifest domain policy', async () => {
    const { broker, manifest, request } = createBroker();
    await expect(broker.httpRequest(manifest.id, null)).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_params' },
    });
    expect(request).not.toHaveBeenCalled();

    await expect(
      broker.httpRequest(manifest.id, { url: 'https://api.example.com/data', allowHttp: true }),
    ).resolves.toMatchObject({ ok: true });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://api.example.com/data' }), {
      allowHttp: false,
      allowedDomains: ['api.example.com'],
    });
  });

  it('issues scoped file tokens and filters environment variables', async () => {
    const { broker, manifest, platform } = createBroker();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-capability-'));
    tempDirs.push(dir);
    const filePath = path.join(dir, 'data.txt');
    fs.writeFileSync(filePath, 'hello');
    vi.mocked(platform.openFiles).mockResolvedValue([filePath]);

    const opened = await broker.fsOpenFileDialog({}, manifest.id, { multiple: false });
    expect(opened).toMatchObject({ ok: true, data: { items: [{ name: 'data.txt' }] } });
    if (!opened.ok) return;
    const item = (opened.data as { items: { fileToken: string }[] }).items[0];
    expect(broker.fsReadFile(manifest.id, item.fileToken, 'utf8')).toEqual({
      ok: true,
      data: { content: 'hello' },
    });
    expect(broker.fsReadFile('market-other-plugin', item.fileToken, 'utf8')).toMatchObject({ ok: false });
    expect(broker.systemGetEnv(manifest.id, ['SAFE_VALUE', 'SECRET_VALUE'])).toEqual({
      ok: true,
      data: { SAFE_VALUE: 'visible' },
    });
  });

  it('forwards authorized plugin logs into the diagnostic event stream', () => {
    const { broker, manifest, recordDiagnostic } = createBroker();

    expect(
      broker.log(manifest.id, { level: 'warn', message: 'request failed', data: { status: 503 } }),
    ).toEqual({
      ok: true,
      data: true,
    });
    expect(recordDiagnostic).toHaveBeenCalledWith({
      level: 'warn',
      source: 'plugin',
      scope: manifest.id,
      message: 'request failed',
      details: { status: 503 },
    });
  });
});
