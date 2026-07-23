import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { protocol } from 'electron';
import type { MarketplacePluginManifest } from '@devtoolbox/core';

const mocks = vi.hoisted(() => ({
  appGetPath: vi.fn(() => '/tmp/devtoolbox-test'),
  protocolHandle: vi.fn(),
  protocolIsHandled: vi.fn(() => false),
  protocolRegisterSchemesAsPrivileged: vi.fn(),
  repositoryGet: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: mocks.appGetPath },
  protocol: {
    handle: mocks.protocolHandle,
    isProtocolHandled: mocks.protocolIsHandled,
    registerSchemesAsPrivileged: mocks.protocolRegisterSchemesAsPrivileged,
  },
}));

vi.mock('../../marketplace/plugin-repository', () => ({
  pluginRepository: { get: mocks.repositoryGet },
}));

import {
  buildPluginContentSecurityPolicy,
  pluginEntryUrl,
  registerPluginProtocol,
  resolvePluginRequestPath,
} from '../plugin-protocol';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-plugin-protocol-'));
  tempDirs.push(dir);
  return dir;
}

function createManifest(overrides: Partial<MarketplacePluginManifest> = {}): MarketplacePluginManifest {
  return {
    id: 'market-example',
    name: 'Example',
    description: '',
    version: '1.0.0',
    sdkVersion: '1.0',
    entry: 'package/index.html',
    categoryId: 'dev-tools',
    author: 'DevToolBox',
    license: 'Apache-2.0',
    homepage: 'https://example.com',
    repository: 'https://example.com',
    permissions: ['storage:kv'],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.appGetPath.mockReturnValue('/tmp/devtoolbox-test');
  mocks.protocolHandle.mockReset();
  mocks.protocolIsHandled.mockReset();
  mocks.protocolIsHandled.mockReturnValue(false);
  mocks.protocolRegisterSchemesAsPrivileged.mockReset();
  mocks.repositoryGet.mockReset();
});

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('Marketplace plugin protocol', () => {
  it('resolves an asset only within its plugin version directory', () => {
    const base = path.resolve('/tmp/devtoolbox/modules');
    expect(
      resolvePluginRequestPath('devtoolbox-plugin://market-example/1.0.0/package/index.html', base),
    ).toEqual({
      pluginId: 'market-example',
      version: '1.0.0',
      filePath: path.join(base, 'market-example', '1.0.0', 'package', 'index.html'),
    });

    expect(
      resolvePluginRequestPath('devtoolbox-plugin://market-example/1.0.0/%2F..%2Fsecret.txt', base),
    ).toBeUndefined();
  });

  it('builds a stable entry URL', () => {
    expect(
      pluginEntryUrl({
        id: 'market-example',
        version: '1.2.3',
        entry: 'package/index.html',
      }),
    ).toBe('devtoolbox-plugin://market-example/1.2.3/package/index.html');
  });

  it('limits CSP network access to declared domains', () => {
    const policy = buildPluginContentSecurityPolicy(
      createManifest({
        permissions: ['http:proxy'],
        httpDomains: ['api.example.com', '*.static.example.com'],
      }),
    );

    expect(policy).toContain("connect-src 'self' https://*.static.example.com https://api.example.com");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain('https:;');
  });

  it('blocks plugin assets while safe mode disables the runtime', async () => {
    registerPluginProtocol({ runtimeEnabled: () => false });
    const handler = vi.mocked(protocol).handle.mock.calls.at(-1)?.[1];
    expect(handler).toBeDefined();

    const response = await handler?.(
      new Request('devtoolbox-plugin://market-example/1.0.0/package/index.html'),
    );
    expect(response?.status).toBe(503);
    await expect(response?.text()).resolves.toBe('Plugins are unavailable in safe mode');
  });

  it('does not serve assets for disabled plugins', async () => {
    const root = tempDir();
    const manifest = createManifest();
    mocks.appGetPath.mockReturnValue(root);
    mocks.repositoryGet.mockReturnValue({
      id: manifest.id,
      version: manifest.version,
      enabled: false,
      installedAt: '2026-01-01T00:00:00.000Z',
      manifest,
    });

    registerPluginProtocol();
    const handler = vi.mocked(protocol).handle.mock.calls.at(-1)?.[1];
    const response = await handler?.(new Request(pluginEntryUrl(manifest)));

    expect(response?.status).toBe(404);
    await expect(response?.text()).resolves.toBe('Plugin not available');
  });

  it('serves installed HTML assets with plugin CSP and no-store cache headers', async () => {
    const root = tempDir();
    const manifest = createManifest({
      permissions: ['http:proxy'],
      httpDomains: ['api.example.com'],
    });
    const pluginRoot = path.join(root, 'modules', manifest.id, manifest.version);
    const entryPath = path.join(pluginRoot, manifest.entry);
    fs.mkdirSync(path.dirname(entryPath), { recursive: true });
    fs.writeFileSync(entryPath, '<!doctype html>');
    mocks.appGetPath.mockReturnValue(root);
    mocks.repositoryGet.mockReturnValue({
      id: manifest.id,
      version: manifest.version,
      enabled: true,
      installedAt: '2026-01-01T00:00:00.000Z',
      manifest,
    });

    registerPluginProtocol();
    const handler = vi.mocked(protocol).handle.mock.calls.at(-1)?.[1];
    const response = await handler?.(new Request(pluginEntryUrl(manifest)));

    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response?.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(response?.headers.get('content-security-policy')).toContain(
      "connect-src 'self' https://api.example.com",
    );
    await expect(response?.text()).resolves.toBe('<!doctype html>');
  });
});
