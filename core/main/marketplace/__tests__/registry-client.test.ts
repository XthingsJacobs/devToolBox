import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMarketplaceRegistry } from '../registry-client';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-registry-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe('Marketplace registry client', () => {
  it('reads and validates file registries only in development', async () => {
    const dir = tempDir();
    const registryPath = path.join(dir, 'registry.json');
    fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, plugins: [] }));
    const url = pathToFileURL(registryPath).toString();

    await expect(
      fetchMarketplaceRegistry(url, {
        cacheDir: dir,
        isDevelopment: true,
        userAgent: 'test',
      }),
    ).resolves.toEqual({ success: true, registry: { schemaVersion: 1, plugins: [] } });
    await expect(
      fetchMarketplaceRegistry(url, {
        cacheDir: dir,
        isDevelopment: false,
        userAgent: 'test',
      }),
    ).resolves.toEqual({ success: false, error: 'Only https is allowed' });
  });

  it('rejects invalid registry payloads', async () => {
    const dir = tempDir();
    const registryPath = path.join(dir, 'registry.json');
    fs.writeFileSync(registryPath, JSON.stringify({ schemaVersion: 1, plugins: [{}] }));

    const result = await fetchMarketplaceRegistry(pathToFileURL(registryPath).toString(), {
      cacheDir: dir,
      isDevelopment: true,
      userAgent: 'test',
    });
    expect(result).toMatchObject({ success: false });
  });

  it('rejects non-HTTPS and private registry hosts before network access', async () => {
    const dir = tempDir();
    const request = vi.fn();

    await expect(
      fetchMarketplaceRegistry('http://example.com/registry.json', {
        cacheDir: dir,
        isDevelopment: false,
        userAgent: 'test',
        request,
      }),
    ).resolves.toEqual({ success: false, error: 'Only https is allowed' });
    await expect(
      fetchMarketplaceRegistry('https://127.0.0.1/registry.json', {
        cacheDir: dir,
        isDevelopment: false,
        userAgent: 'test',
        request,
      }),
    ).resolves.toEqual({ success: false, error: 'Forbidden target' });
    expect(request).not.toHaveBeenCalled();
  });

  it('caches a validated HTTPS response', async () => {
    const dir = tempDir();
    const request = vi.fn().mockResolvedValue({
      status: 200,
      headers: { etag: 'v1' },
      data: JSON.stringify({ schemaVersion: 1, plugins: [] }),
    });
    const options = {
      cacheDir: dir,
      isDevelopment: false,
      userAgent: 'test',
      now: () => 1000,
      request,
    };

    await expect(
      fetchMarketplaceRegistry('https://example.com/registry.json', options),
    ).resolves.toMatchObject({
      success: true,
    });
    await expect(
      fetchMarketplaceRegistry('https://example.com/registry.json', options),
    ).resolves.toMatchObject({
      success: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/registry.json',
        timeoutMs: 30_000,
        responseType: 'text',
        headers: expect.objectContaining({
          'user-agent': 'test',
          accept: 'application/json, text/plain, */*',
        }),
      }),
      { maxBytes: 2 * 1024 * 1024 },
    );
  });

  it('adds conditional cache-busting headers when forced', async () => {
    const dir = tempDir();
    const request = vi.fn().mockResolvedValue({
      status: 200,
      headers: { etag: 'v1', 'last-modified': 'Mon, 20 Jul 2026 00:00:00 GMT' },
      data: JSON.stringify({ schemaVersion: 1, plugins: [] }),
    });

    await fetchMarketplaceRegistry('https://example.com/registry.json', {
      cacheDir: dir,
      isDevelopment: false,
      userAgent: 'test',
      now: () => 2000,
      force: true,
      request,
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/registry.json?_=2000',
        headers: expect.objectContaining({
          'cache-control': 'no-cache',
          pragma: 'no-cache',
        }),
      }),
      { maxBytes: 2 * 1024 * 1024 },
    );
  });
});
