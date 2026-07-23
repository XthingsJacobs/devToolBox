import { describe, expect, it } from 'vitest';
import {
  validateBackupExportOptions,
  validateBackupImportParams,
  validateFileFilters,
  validateHttpRequestParams,
  validateMarketplaceRegistryEntry,
} from '../validation';

const manifest = {
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
  permissions: ['storage:kv'],
};

describe('IPC payload validation', () => {
  it('accepts valid filters and rejects malformed extensions', () => {
    expect(validateFileFilters([{ name: 'Text', extensions: ['txt'] }])).toMatchObject({ ok: true });
    expect(validateFileFilters([{ name: 'Text', extensions: ['../txt'] }])).toEqual({
      ok: false,
      error: 'Invalid file filter extension',
    });
  });

  it('requires typed backup options and supported encodings', () => {
    expect(
      validateBackupExportOptions({ bindToDevice: false, localStorage: { key: 'value' } }),
    ).toMatchObject({
      ok: true,
    });
    expect(validateBackupExportOptions({ bindToDevice: 'no' })).toMatchObject({ ok: false });
    expect(validateBackupImportParams({ content: 'data', encoding: 'hex' })).toMatchObject({ ok: false });
  });

  it('rejects malformed HTTP parameters before network access', () => {
    expect(validateHttpRequestParams(null)).toMatchObject({ ok: false });
    expect(validateHttpRequestParams({ url: 'https://example.com', headers: { accept: 1 } })).toMatchObject({
      ok: false,
    });
  });

  it('normalizes and validates Marketplace entries', () => {
    const result = validateMarketplaceRegistryEntry({
      manifest,
      downloadUrl: 'https://example.com/plugin.zip',
      sha256: 'A'.repeat(64),
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.data.sha256).toBe('a'.repeat(64));
    expect(validateMarketplaceRegistryEntry({ manifest, downloadUrl: 'x', sha256: 'bad' })).toMatchObject({
      ok: false,
    });
  });

  it('validates signed package provenance before it reaches the installer', () => {
    const provenance = {
      schemaVersion: 1,
      algorithm: 'ed25519',
      publisher: 'example-publisher',
      keyId: 'example-key',
      source: {
        repository: 'https://example.com/repository',
        revision: 'a'.repeat(40),
      },
      signature: Buffer.alloc(64).toString('base64'),
    };
    expect(
      validateMarketplaceRegistryEntry({
        manifest,
        downloadUrl: 'https://example.com/plugin.zip',
        sha256: 'a'.repeat(64),
        provenance,
      }),
    ).toEqual({ ok: false, error: 'Signed packages require an exact package size' });
    expect(
      validateMarketplaceRegistryEntry({
        manifest,
        downloadUrl: 'https://example.com/plugin.zip',
        sha256: 'a'.repeat(64),
        size: 123,
        publishedAt: '2026-07-20T00:00:00.000Z',
        provenance: { ...provenance, signature: 'not-base64' },
      }),
    ).toEqual({ ok: false, error: 'Invalid provenance signature' });
  });
});
