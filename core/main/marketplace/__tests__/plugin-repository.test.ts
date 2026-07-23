import { describe, expect, it } from 'vitest';
import type { MarketplacePluginManifest } from '@devtoolbox/core';
import type { MarketplaceState, MarketplaceStateStore } from '../plugin-repository';
import { PluginRepository, parseMarketplaceState } from '../plugin-repository';

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
  permissions: ['storage:kv'],
};

function createStore(initial: unknown): MarketplaceStateStore & { value: unknown } {
  return {
    value: initial,
    read() {
      return this.value;
    },
    write(state: MarketplaceState) {
      this.value = state;
    },
  };
}

describe('PluginRepository', () => {
  it('drops malformed and mismatched persisted records', () => {
    const parsed = parseMarketplaceState({
      installed: {
        'market-example-tool': {
          id: 'market-example-tool',
          version: '2.0.0',
          enabled: true,
          installedAt: '2026-01-01T00:00:00.000Z',
          manifest,
        },
        invalid: {},
      },
    });
    expect(parsed).toEqual({ installed: {} });
  });

  it('persists enable changes without changing plugin metadata', () => {
    const record = {
      id: manifest.id,
      version: manifest.version,
      enabled: true,
      installedAt: '2026-01-01T00:00:00.000Z',
      manifest,
    };
    const store = createStore({ installed: { [manifest.id]: record } });
    const repository = new PluginRepository(store);

    expect(repository.setEnabled(manifest.id, false)).toBe(true);
    expect(repository.get(manifest.id)).toMatchObject({ enabled: false, installedAt: record.installedAt });
  });

  it('preserves validated install provenance while loading persisted state', () => {
    const provenance = {
      status: 'verified' as const,
      publisher: 'example-publisher',
      keyId: 'example-key',
      source: {
        repository: manifest.repository,
        revision: 'a'.repeat(40),
      },
    };
    const parsed = parseMarketplaceState({
      installed: {
        [manifest.id]: {
          id: manifest.id,
          version: manifest.version,
          enabled: true,
          installedAt: '2026-01-01T00:00:00.000Z',
          manifest,
          provenance,
        },
      },
    });
    expect(parsed.installed[manifest.id].provenance).toEqual(provenance);
  });

  it('returns the previous record when replacing or removing a plugin', () => {
    const store = createStore({ installed: {} });
    const repository = new PluginRepository(store);
    const record = {
      id: manifest.id,
      version: manifest.version,
      enabled: true,
      installedAt: '2026-01-01T00:00:00.000Z',
      manifest,
    };

    expect(repository.save(record)).toBeUndefined();
    expect(repository.save({ ...record, enabled: false })).toMatchObject({ enabled: true });
    expect(repository.remove(manifest.id)).toMatchObject({ enabled: false });
    expect(repository.get(manifest.id)).toBeUndefined();
  });
});
