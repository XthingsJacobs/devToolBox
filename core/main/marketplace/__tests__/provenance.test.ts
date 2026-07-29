import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { MarketplacePluginManifest, MarketplaceRegistryEntry } from '@devtoolbox/core';
import {
  parseMarketplaceTrustConfig,
  verifyMarketplaceProvenance,
  type MarketplaceProvenancePolicy,
} from '../provenance';
import {
  assertSigningEntryTrusted,
  signMarketplaceEntry,
} from '../../../../marketplace/scripts/provenance.mjs';
import trustedPublisherConfig from '../trusted-publishers.json';

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
  homepage: 'https://github.com/example/plugins',
  repository: 'https://github.com/example/plugins',
  permissions: ['storage:kv'],
};

function signedFixture() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const publicBytes = publicKey.export({ format: 'der', type: 'spki' });
  const keyId = `sha256-${crypto.createHash('sha256').update(publicBytes).digest('hex')}`;
  const unsignedEntry: MarketplaceRegistryEntry = {
    manifest,
    downloadUrl: 'https://example.com/plugin.zip',
    sha256: 'a'.repeat(64),
    size: 1234,
    publishedAt: '2026-07-20T00:00:00.000Z',
  };
  const signingConfig = {
    privateKey,
    publicKey: publicBytes.toString('base64'),
    publisher: 'example-publisher',
    keyId,
    source: {
      repository: manifest.repository,
      revision: 'b'.repeat(40),
      workflow: 'https://github.com/example/plugins/actions/runs/123',
    },
  };
  const entry = signMarketplaceEntry(unsignedEntry, signingConfig);
  const policy: MarketplaceProvenancePolicy = {
    mode: 'strict',
    publishers: [
      {
        publisher: 'example-publisher',
        keyId,
        publicKey: publicBytes.toString('base64'),
        sourceRepositories: [manifest.repository],
      },
    ],
  };
  return { entry, policy, signingConfig };
}

describe('Marketplace package provenance', () => {
  it('verifies a trusted Ed25519 signature and its source scope', () => {
    const { entry, policy, signingConfig } = signedFixture();
    expect(verifyMarketplaceProvenance(entry, policy)).toEqual({
      ok: true,
      provenance: {
        status: 'verified',
        publisher: entry.provenance?.publisher,
        keyId: entry.provenance?.keyId,
        source: entry.provenance?.source,
      },
    });
    expect(() =>
      assertSigningEntryTrusted(entry, signingConfig, {
        publishers: policy.publishers,
      }),
    ).not.toThrow();
    expect(() =>
      assertSigningEntryTrusted(entry, signingConfig, {
        publishers: [{ ...policy.publishers[0], pluginIds: ['market-another-tool'] }],
      }),
    ).toThrow('is not trusted for market-example-tool');
  });

  it('rejects artifact tampering and publisher scope violations in every mode', () => {
    const { entry, policy } = signedFixture();
    expect(
      verifyMarketplaceProvenance({ ...entry, sha256: 'c'.repeat(64) }, { ...policy, mode: 'audit' }),
    ).toEqual({ ok: false, error: 'Package provenance signature is invalid' });

    policy.publishers[0].pluginIds = ['market-another-tool'];
    expect(verifyMarketplaceProvenance(entry, policy)).toEqual({
      ok: false,
      error: 'Publisher is not trusted for this plugin id',
    });
  });

  it('allows legacy packages only in audit mode and labels unknown keys as untrusted', () => {
    const { entry } = signedFixture();
    expect(
      verifyMarketplaceProvenance({ ...entry, provenance: undefined }, { mode: 'audit', publishers: [] }),
    ).toEqual({ ok: true, provenance: { status: 'unsigned' } });
    expect(
      verifyMarketplaceProvenance({ ...entry, provenance: undefined }, { mode: 'strict', publishers: [] }),
    ).toEqual({ ok: false, error: 'A trusted package signature is required' });
    expect(verifyMarketplaceProvenance(entry, { mode: 'audit', publishers: [] })).toMatchObject({
      ok: true,
      provenance: { status: 'untrusted', publisher: 'example-publisher' },
    });
  });

  it('validates trusted publisher key material and requires a bounded scope', () => {
    const { policy } = signedFixture();
    expect(
      parseMarketplaceTrustConfig({ schemaVersion: 1, mode: 'audit', publishers: policy.publishers }),
    ).toMatchObject({ ok: true, policy: { mode: 'audit' } });
    expect(
      parseMarketplaceTrustConfig({
        schemaVersion: 1,
        mode: 'strict',
        publishers: [{ ...policy.publishers[0], sourceRepositories: undefined }],
      }),
    ).toEqual({ ok: false, error: 'Invalid trusted publisher entry' });
  });

  it('loads the enrolled official publisher key with explicit plugin and repository scopes', () => {
    const result = parseMarketplaceTrustConfig(trustedPublisherConfig);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.policy).toMatchObject({
      mode: 'audit',
      publishers: [
        {
          publisher: 'devtoolbox-official',
          keyId: 'sha256-27d34403da3feda5439b477441d9ae8af076e91252a84fd335a0d721ece729f6',
          pluginIds: [
            'market-emoji-search',
            'market-exchange-rate',
            'market-ip-lookup',
            'market-matter-catalog',
          ],
          sourceRepositories: ['https://github.com/jacobs-256/devToolBox'],
        },
      ],
    });
  });
});
