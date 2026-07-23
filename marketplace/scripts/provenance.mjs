import crypto from 'node:crypto';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalize(value) {
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

function sortedStrings(value) {
  return Array.from(new Set(Array.isArray(value) ? value : [])).sort();
}

function manifestIdentity(manifest) {
  return {
    author: String(manifest.author).trim(),
    categoryId: String(manifest.categoryId).trim(),
    entry: String(manifest.entry).trim(),
    envAllowlist: sortedStrings(manifest.envAllowlist),
    homepage: String(manifest.homepage).trim(),
    httpDomains: sortedStrings(manifest.httpDomains),
    id: String(manifest.id).trim(),
    license: String(manifest.license).trim(),
    permissions: sortedStrings(manifest.permissions),
    repository: String(manifest.repository).trim(),
    sdkVersion: String(manifest.sdkVersion).trim(),
    version: String(manifest.version).trim(),
  };
}

export function provenancePayload(entry) {
  if (!entry.provenance) throw new Error('Package provenance is required');
  return canonicalize({
    artifact: {
      manifest: manifestIdentity(entry.manifest),
      publishedAt: entry.publishedAt ?? null,
      sha256: entry.sha256,
      size: entry.size ?? null,
    },
    claim: {
      algorithm: entry.provenance.algorithm,
      keyId: entry.provenance.keyId,
      publisher: entry.provenance.publisher,
      source: entry.provenance.source,
    },
    domain: 'devtoolbox.marketplace.package/v1',
  });
}

function sourceFromEnvironment(environment) {
  const repository = String(
    environment.MARKETPLACE_SOURCE_REPOSITORY ??
      (environment.GITHUB_REPOSITORY
        ? `${environment.GITHUB_SERVER_URL ?? 'https://github.com'}/${environment.GITHUB_REPOSITORY}`
        : ''),
  ).trim();
  const revision = String(environment.MARKETPLACE_SOURCE_REVISION ?? environment.GITHUB_SHA ?? '')
    .trim()
    .toLowerCase();
  const workflow = String(
    environment.MARKETPLACE_SOURCE_WORKFLOW ??
      (environment.GITHUB_REPOSITORY && environment.GITHUB_RUN_ID
        ? `${environment.GITHUB_SERVER_URL ?? 'https://github.com'}/${environment.GITHUB_REPOSITORY}/actions/runs/${environment.GITHUB_RUN_ID}`
        : ''),
  ).trim();
  if (!/^https:\/\/[^\s]{1,2040}$/.test(repository)) {
    throw new Error('Marketplace signing requires an HTTPS source repository');
  }
  if (!/^[a-f0-9]{40,64}$/.test(revision)) {
    throw new Error('Marketplace signing requires a 40-64 character hexadecimal source revision');
  }
  if (workflow && !/^https:\/\/[^\s]{1,2040}$/.test(workflow)) {
    throw new Error('Marketplace signing source workflow must be an HTTPS URL');
  }
  return { repository, revision, workflow: workflow || undefined };
}

export function signingConfigFromEnvironment(environment = process.env) {
  const encodedKey = String(environment.MARKETPLACE_SIGNING_PRIVATE_KEY_BASE64 ?? '').trim();
  const required = String(environment.MARKETPLACE_REQUIRE_SIGNATURES ?? '').toLowerCase() === 'true';
  if (!encodedKey) {
    if (required) throw new Error('MARKETPLACE_SIGNING_PRIVATE_KEY_BASE64 is required');
    return undefined;
  }

  let privateKey;
  try {
    const keyBytes = Buffer.from(encodedKey, 'base64');
    if (!keyBytes.length || keyBytes.toString('base64') !== encodedKey) throw new Error('invalid base64');
    privateKey = crypto.createPrivateKey({ key: keyBytes, format: 'der', type: 'pkcs8' });
  } catch {
    throw new Error('MARKETPLACE_SIGNING_PRIVATE_KEY_BASE64 is not a valid PKCS8 key');
  }
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('Marketplace signing requires an Ed25519 private key');
  }

  const publisher = String(environment.MARKETPLACE_SIGNING_PUBLISHER ?? '').trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(publisher)) {
    throw new Error('MARKETPLACE_SIGNING_PUBLISHER is invalid');
  }
  const publicKey = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
  const keyId = `sha256-${crypto.createHash('sha256').update(publicKey).digest('hex')}`;
  return {
    privateKey,
    publicKey: publicKey.toString('base64'),
    publisher,
    keyId,
    source: sourceFromEnvironment(environment),
  };
}

function normalizedRepository(value) {
  return String(value ?? '')
    .trim()
    .replace(/\/+$/, '');
}

export function assertSigningEntryTrusted(entry, config, trustConfig) {
  const publishers = Array.isArray(trustConfig?.publishers) ? trustConfig.publishers : [];
  const trusted = publishers.find(
    (candidate) =>
      candidate?.publisher === config.publisher &&
      candidate?.keyId === config.keyId &&
      candidate?.publicKey === config.publicKey,
  );
  if (!trusted) {
    throw new Error(`Signing key ${config.keyId} is not enrolled for publisher ${config.publisher}`);
  }
  const pluginIds = Array.isArray(trusted.pluginIds) ? trusted.pluginIds : [];
  if (pluginIds.length > 0 && !pluginIds.includes(entry.manifest.id)) {
    throw new Error(`Signing key ${config.keyId} is not trusted for ${entry.manifest.id}`);
  }
  const repositories = Array.isArray(trusted.sourceRepositories)
    ? trusted.sourceRepositories.map(normalizedRepository)
    : [];
  if (repositories.length > 0 && !repositories.includes(normalizedRepository(config.source.repository))) {
    throw new Error(`Signing key ${config.keyId} is not trusted for ${config.source.repository}`);
  }
  if (normalizedRepository(config.source.repository) !== normalizedRepository(entry.manifest.repository)) {
    throw new Error(`Signing source does not match the manifest repository for ${entry.manifest.id}`);
  }
}

export function signMarketplaceEntry(entry, config) {
  const unsignedProvenance = {
    schemaVersion: 1,
    algorithm: 'ed25519',
    publisher: config.publisher,
    keyId: config.keyId,
    source: config.source,
    signature: '',
  };
  const unsignedEntry = { ...entry, provenance: unsignedProvenance };
  const signature = crypto
    .sign(null, Buffer.from(provenancePayload(unsignedEntry), 'utf8'), config.privateKey)
    .toString('base64');
  return { ...entry, provenance: { ...unsignedProvenance, signature } };
}
