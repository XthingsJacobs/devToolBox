import { describe, expect, it } from 'vitest';
import { compareManifests, validateHttpDomain, validateManifest } from '../manifest';

const validManifest = {
  id: 'market-example-tool',
  name: 'Example Tool',
  description: 'Example plugin',
  version: '1.0.0',
  sdkVersion: '1.0',
  entry: 'package/index.html',
  categoryId: 'dev-tools',
  author: 'DevToolBox',
  license: 'Apache-2.0',
  homepage: 'https://example.com',
  repository: 'https://example.com/repository',
  permissions: ['storage:kv', 'http:proxy'],
  httpDomains: ['api.example.com'],
};

describe('Marketplace manifest validation', () => {
  it('normalizes a valid manifest and preserves optional metadata', () => {
    const result = validateManifest({
      ...validManifest,
      tags: ['formatter', 'formatter'],
      maintainers: ['alice'],
      deprecated: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.permissions).toEqual(['http:proxy', 'storage:kv']);
    expect(result.data.tags).toEqual(['formatter']);
    expect(result.data.maintainers).toEqual(['alice']);
    expect(result.data.deprecated).toBe(false);
  });

  it('rejects unknown permissions and unsupported SDK versions', () => {
    expect(validateManifest({ ...validManifest, permissions: ['system:exec'] })).toEqual({
      ok: false,
      error: 'unsupported permission',
    });
    expect(validateManifest({ ...validManifest, sdkVersion: '9.0' })).toEqual({
      ok: false,
      error: 'unsupported sdkVersion',
    });
  });

  it('rejects versions and entry paths that can escape the install directory', () => {
    expect(validateManifest({ ...validManifest, version: '../../outside' })).toEqual({
      ok: false,
      error: 'invalid version',
    });
    expect(validateManifest({ ...validManifest, entry: '../index.html' })).toEqual({
      ok: false,
      error: 'invalid entry',
    });
    expect(validateManifest({ ...validManifest, entry: 'package\\index.html' })).toEqual({
      ok: false,
      error: 'invalid entry',
    });
    expect(validateManifest({ ...validManifest, entry: 'C:/outside.html' })).toEqual({
      ok: false,
      error: 'invalid entry',
    });
  });

  it('enforces safe network domains', () => {
    expect(validateHttpDomain('api.example.com')).toBe(true);
    expect(validateHttpDomain('*.example.com')).toBe(true);
    expect(validateHttpDomain('localhost')).toBe(false);
    expect(validateHttpDomain('https://example.com')).toBe(false);
    expect(validateHttpDomain('*')).toBe(false);
  });

  it('detects registry and package capability mismatches', () => {
    const registry = validateManifest(validManifest);
    const packaged = validateManifest({ ...validManifest, permissions: ['storage:kv'] });
    expect(registry.ok).toBe(true);
    expect(packaged.ok).toBe(true);
    if (!registry.ok || !packaged.ok) return;
    expect(compareManifests(registry.data, packaged.data)).toContain('permissions mismatch');
  });
});
