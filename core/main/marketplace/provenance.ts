import crypto from 'node:crypto';
import type {
  MarketplaceInstalledProvenance,
  MarketplacePackageProvenance,
  MarketplaceRegistryEntry,
} from '@devtoolbox/core';

export type MarketplaceProvenanceMode = 'audit' | 'strict';

export interface TrustedMarketplacePublisher {
  publisher: string;
  keyId: string;
  publicKey: string;
  pluginIds?: string[];
  sourceRepositories?: string[];
}

export interface MarketplaceProvenancePolicy {
  mode: MarketplaceProvenanceMode;
  publishers: TrustedMarketplacePublisher[];
}

export type MarketplaceProvenanceDecision =
  | { ok: true; provenance: MarketplaceInstalledProvenance }
  | { ok: false; error: string };

type TrustConfigResult = { ok: true; policy: MarketplaceProvenancePolicy } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot canonicalize a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new Error(`Cannot canonicalize ${typeof value}`);
}

function normalizedRepository(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function provenanceClaim(provenance: MarketplacePackageProvenance) {
  return {
    algorithm: provenance.algorithm,
    keyId: provenance.keyId,
    publisher: provenance.publisher,
    source: provenance.source,
  };
}

function sortedStrings(value: string[] | undefined): string[] {
  return Array.from(new Set(value ?? [])).sort();
}

function manifestIdentity(entry: MarketplaceRegistryEntry['manifest']) {
  return {
    author: entry.author.trim(),
    categoryId: entry.categoryId.trim(),
    entry: entry.entry.trim(),
    envAllowlist: sortedStrings(entry.envAllowlist),
    homepage: entry.homepage.trim(),
    httpDomains: sortedStrings(entry.httpDomains),
    id: entry.id.trim(),
    license: entry.license.trim(),
    permissions: sortedStrings(entry.permissions),
    repository: entry.repository.trim(),
    sdkVersion: entry.sdkVersion.trim(),
    version: entry.version.trim(),
  };
}

export function marketplaceProvenancePayload(
  entry: Pick<MarketplaceRegistryEntry, 'manifest' | 'sha256' | 'size' | 'publishedAt' | 'provenance'>,
): string {
  if (!entry.provenance) throw new Error('Package provenance is required');
  return canonicalize({
    artifact: {
      manifest: manifestIdentity(entry.manifest),
      publishedAt: entry.publishedAt ?? null,
      sha256: entry.sha256,
      size: entry.size ?? null,
    },
    claim: provenanceClaim(entry.provenance),
    domain: 'devtoolbox.marketplace.package/v1',
  });
}

function publicKeyFor(publisher: TrustedMarketplacePublisher): crypto.KeyObject | undefined {
  try {
    const encoded = Buffer.from(publisher.publicKey, 'base64');
    if (!encoded.length || encoded.toString('base64') !== publisher.publicKey) return undefined;
    const key = crypto.createPublicKey({ key: encoded, format: 'der', type: 'spki' });
    const expectedKeyId = `sha256-${crypto.createHash('sha256').update(encoded).digest('hex')}`;
    return key.asymmetricKeyType === 'ed25519' && publisher.keyId === expectedKeyId ? key : undefined;
  } catch {
    return undefined;
  }
}

function publisherScopeError(
  entry: MarketplaceRegistryEntry,
  publisher: TrustedMarketplacePublisher,
): string | undefined {
  const pluginIds = publisher.pluginIds ?? [];
  const repositories = publisher.sourceRepositories ?? [];
  if (pluginIds.length > 0 && !pluginIds.includes(entry.manifest.id)) {
    return 'Publisher is not trusted for this plugin id';
  }
  if (
    repositories.length > 0 &&
    !repositories
      .map(normalizedRepository)
      .includes(normalizedRepository(entry.provenance?.source.repository ?? ''))
  ) {
    return 'Publisher is not trusted for this source repository';
  }
  if (
    normalizedRepository(entry.provenance?.source.repository ?? '') !==
    normalizedRepository(entry.manifest.repository)
  ) {
    return 'Provenance source does not match the plugin manifest repository';
  }
  return undefined;
}

export function verifyMarketplaceProvenance(
  entry: MarketplaceRegistryEntry,
  policy: MarketplaceProvenancePolicy,
): MarketplaceProvenanceDecision {
  const provenance = entry.provenance;
  if (!provenance) {
    if (policy.mode === 'strict') return { ok: false, error: 'A trusted package signature is required' };
    return { ok: true, provenance: { status: 'unsigned' } };
  }

  const trusted = policy.publishers.find(
    (candidate) => candidate.publisher === provenance.publisher && candidate.keyId === provenance.keyId,
  );
  if (!trusted) {
    if (policy.mode === 'strict') return { ok: false, error: 'Package publisher is not trusted' };
    return {
      ok: true,
      provenance: {
        status: 'untrusted',
        publisher: provenance.publisher,
        keyId: provenance.keyId,
        source: provenance.source,
      },
    };
  }

  const scopeError = publisherScopeError(entry, trusted);
  if (scopeError) return { ok: false, error: scopeError };
  const publicKey = publicKeyFor(trusted);
  if (!publicKey) return { ok: false, error: 'Trusted publisher key is invalid' };

  let verified = false;
  try {
    verified = crypto.verify(
      null,
      Buffer.from(marketplaceProvenancePayload(entry), 'utf8'),
      publicKey,
      Buffer.from(provenance.signature, 'base64'),
    );
  } catch {
    verified = false;
  }
  if (!verified) return { ok: false, error: 'Package provenance signature is invalid' };
  return {
    ok: true,
    provenance: {
      status: 'verified',
      publisher: provenance.publisher,
      keyId: provenance.keyId,
      source: provenance.source,
    },
  };
}

function stringArray(value: unknown): { ok: true; data?: string[] } | { ok: false } {
  if (value === undefined) return { ok: true, data: undefined };
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    return { ok: false };
  }
  return { ok: true, data: Array.from(new Set(value.map((item) => String(item).trim()))).sort() };
}

export function parseMarketplaceTrustConfig(value: unknown): TrustConfigResult {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    (value.mode !== 'audit' && value.mode !== 'strict') ||
    !Array.isArray(value.publishers)
  ) {
    return { ok: false, error: 'Invalid Marketplace trust configuration' };
  }

  const publishers: TrustedMarketplacePublisher[] = [];
  const identities = new Set<string>();
  for (const candidate of value.publishers) {
    if (!isRecord(candidate)) return { ok: false, error: 'Invalid trusted publisher entry' };
    const pluginIds = stringArray(candidate.pluginIds);
    const sourceRepositories = stringArray(candidate.sourceRepositories);
    if (
      !pluginIds.ok ||
      !sourceRepositories.ok ||
      typeof candidate.publisher !== 'string' ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(candidate.publisher) ||
      typeof candidate.keyId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(candidate.keyId) ||
      typeof candidate.publicKey !== 'string' ||
      (!pluginIds.data?.length && !sourceRepositories.data?.length) ||
      pluginIds.data?.some((id) => !/^market-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) ||
      sourceRepositories.data?.some((repository) => !/^https:\/\/[^\s]{1,2040}$/.test(repository))
    ) {
      return { ok: false, error: 'Invalid trusted publisher entry' };
    }
    const publisher: TrustedMarketplacePublisher = {
      publisher: candidate.publisher,
      keyId: candidate.keyId,
      publicKey: candidate.publicKey,
      pluginIds: pluginIds.data,
      sourceRepositories: sourceRepositories.data,
    };
    if (!publicKeyFor(publisher)) return { ok: false, error: 'Invalid trusted publisher public key' };
    const identity = `${publisher.publisher}:${publisher.keyId}`;
    if (identities.has(identity)) return { ok: false, error: 'Duplicate trusted publisher key' };
    identities.add(identity);
    publishers.push(publisher);
  }
  return { ok: true, policy: { mode: value.mode, publishers } };
}
