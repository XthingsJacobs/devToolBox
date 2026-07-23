import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { provenancePayload } from './provenance.mjs';

const marketplaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.resolve(
  process.argv[2] ?? path.join(marketplaceRoot, 'release-dist/registry.json'),
);
const trustPath = path.resolve(
  process.argv[3] ?? path.join(marketplaceRoot, '../core/main/marketplace/trusted-publishers.json'),
);
const requireSignatures = String(process.env.MARKETPLACE_REQUIRE_SIGNATURES ?? '').toLowerCase() === 'true';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizedRepository(value) {
  return String(value ?? '')
    .trim()
    .replace(/\/+$/, '');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function archivePathFor(entry) {
  const url = new URL(entry.downloadUrl);
  const fileName = path.basename(decodeURIComponent(url.pathname));
  if (!/^market-[a-z0-9]+(?:-[a-z0-9]+)*-[0-9A-Za-z._+-]+\.zip$/.test(fileName)) {
    throw new Error(`Invalid release archive name for ${entry.manifest?.id ?? 'unknown plugin'}`);
  }
  return path.join(path.dirname(registryPath), fileName);
}

function verifyArtifact(entry) {
  const archivePath = archivePathFor(entry);
  const stat = fs.statSync(archivePath);
  if (!stat.isFile() || stat.size !== entry.size) {
    throw new Error(`Package size mismatch for ${entry.manifest.id}`);
  }
  if (sha256File(archivePath) !== entry.sha256) {
    throw new Error(`Package SHA256 mismatch for ${entry.manifest.id}`);
  }
}

function verifyProvenance(entry, trustConfig) {
  const provenance = entry.provenance;
  if (!provenance) {
    if (requireSignatures) throw new Error(`Missing package provenance for ${entry.manifest.id}`);
    return false;
  }
  const trusted = trustConfig.publishers.find(
    (candidate) => candidate.publisher === provenance.publisher && candidate.keyId === provenance.keyId,
  );
  if (!trusted) throw new Error(`Untrusted publisher key for ${entry.manifest.id}`);
  if (Array.isArray(trusted.pluginIds) && !trusted.pluginIds.includes(entry.manifest.id)) {
    throw new Error(`Publisher key is not trusted for ${entry.manifest.id}`);
  }
  const repositories = Array.isArray(trusted.sourceRepositories)
    ? trusted.sourceRepositories.map(normalizedRepository)
    : [];
  if (
    repositories.length > 0 &&
    !repositories.includes(normalizedRepository(provenance.source?.repository))
  ) {
    throw new Error(`Publisher key is not trusted for the source of ${entry.manifest.id}`);
  }
  if (
    normalizedRepository(provenance.source?.repository) !== normalizedRepository(entry.manifest.repository)
  ) {
    throw new Error(`Provenance source mismatch for ${entry.manifest.id}`);
  }

  const publicBytes = Buffer.from(trusted.publicKey, 'base64');
  const keyId = `sha256-${crypto.createHash('sha256').update(publicBytes).digest('hex')}`;
  if (keyId !== trusted.keyId) throw new Error(`Public key fingerprint mismatch for ${entry.manifest.id}`);
  const publicKey = crypto.createPublicKey({ key: publicBytes, format: 'der', type: 'spki' });
  if (publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(`Unsupported publisher key for ${entry.manifest.id}`);
  }
  if (
    !crypto.verify(
      null,
      Buffer.from(provenancePayload(entry), 'utf8'),
      publicKey,
      Buffer.from(provenance.signature, 'base64'),
    )
  ) {
    throw new Error(`Invalid package provenance signature for ${entry.manifest.id}`);
  }
  return true;
}

const registry = readJson(registryPath);
const trustConfig = readJson(trustPath);
if (registry?.schemaVersion !== 1 || !Array.isArray(registry.plugins)) {
  throw new Error('Invalid Marketplace release registry');
}
if (trustConfig?.schemaVersion !== 1 || !Array.isArray(trustConfig.publishers)) {
  throw new Error('Invalid Marketplace publisher trust configuration');
}

let signedCount = 0;
for (const entry of registry.plugins) {
  verifyArtifact(entry);
  if (verifyProvenance(entry, trustConfig)) signedCount += 1;
}
process.stdout.write(
  `Marketplace release verification passed (${registry.plugins.length} packages, ${signedCount} signed).\n`,
);
