import type {
  BackupExportOptions,
  BackupImportParams,
  FileFilter,
  HttpRequestParams,
  MarketplaceRegistry,
  MarketplaceRegistryEntry,
  MarketplacePackageProvenance,
} from '@devtoolbox/core';
import { validateManifest } from '../marketplace/manifest';

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validStringRecord(value: unknown, maxEntries: number): value is Record<string, string> {
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= maxEntries &&
    entries.every(([key, item]) => key.length <= 256 && typeof item === 'string')
  );
}

export function validateFileFilters(value: unknown): ValidationResult<FileFilter[] | undefined> {
  if (value === undefined) return { ok: true, data: undefined };
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    return { ok: false, error: 'Invalid file filters' };
  }

  const filters: FileFilter[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 128) {
      return { ok: false, error: 'Invalid file filter name' };
    }
    if (!Array.isArray(item.extensions) || item.extensions.length === 0 || item.extensions.length > 100) {
      return { ok: false, error: 'Invalid file filter extensions' };
    }
    const extensions = item.extensions.filter(
      (extension): extension is string => typeof extension === 'string',
    );
    if (
      extensions.length !== item.extensions.length ||
      extensions.some((extension) => !extension || extension.length > 32 || /[\\/]/.test(extension))
    ) {
      return { ok: false, error: 'Invalid file filter extension' };
    }
    filters.push({ name: item.name.trim(), extensions });
  }
  return { ok: true, data: filters };
}

export function validateBackupExportOptions(value: unknown): ValidationResult<BackupExportOptions> {
  if (!isRecord(value) || typeof value.bindToDevice !== 'boolean') {
    return { ok: false, error: 'Invalid backup export options' };
  }
  if (value.password !== undefined && typeof value.password !== 'string') {
    return { ok: false, error: 'Invalid backup password' };
  }
  if (value.localStorage !== undefined && !validStringRecord(value.localStorage, 10_000)) {
    return { ok: false, error: 'Invalid local storage snapshot' };
  }
  return {
    ok: true,
    data: {
      bindToDevice: value.bindToDevice,
      password: value.password,
      localStorage: value.localStorage,
    },
  };
}

export function validateBackupImportParams(value: unknown): ValidationResult<BackupImportParams> {
  if (!isRecord(value) || typeof value.content !== 'string') {
    return { ok: false, error: 'Invalid backup import payload' };
  }
  if (value.content.length > 150 * 1024 * 1024) {
    return { ok: false, error: 'Backup import payload is too large' };
  }
  if (value.password !== undefined && typeof value.password !== 'string') {
    return { ok: false, error: 'Invalid backup password' };
  }
  if (value.encoding !== undefined && value.encoding !== 'utf8' && value.encoding !== 'base64') {
    return { ok: false, error: 'Invalid backup encoding' };
  }
  return {
    ok: true,
    data: {
      content: value.content,
      password: value.password,
      encoding: value.encoding,
    },
  };
}

export function validateHttpRequestParams(value: unknown): ValidationResult<HttpRequestParams> {
  if (!isRecord(value) || typeof value.url !== 'string' || !value.url.trim() || value.url.length > 8192) {
    return { ok: false, error: 'Invalid URL' };
  }
  if (value.method !== undefined && (typeof value.method !== 'string' || value.method.length > 32)) {
    return { ok: false, error: 'Invalid HTTP method' };
  }
  if (value.headers !== undefined && !validStringRecord(value.headers, 200)) {
    return { ok: false, error: 'Invalid HTTP headers' };
  }
  if (value.body !== undefined && typeof value.body !== 'string') {
    return { ok: false, error: 'Invalid HTTP body' };
  }
  if (
    value.timeoutMs !== undefined &&
    (typeof value.timeoutMs !== 'number' || !Number.isFinite(value.timeoutMs))
  ) {
    return { ok: false, error: 'Invalid HTTP timeout' };
  }
  if (
    value.responseType !== undefined &&
    value.responseType !== 'text' &&
    value.responseType !== 'json' &&
    value.responseType !== 'arrayBuffer'
  ) {
    return { ok: false, error: 'Invalid HTTP response type' };
  }
  if (value.allowHttp !== undefined && typeof value.allowHttp !== 'boolean') {
    return { ok: false, error: 'Invalid HTTP policy' };
  }

  return {
    ok: true,
    data: {
      url: value.url.trim(),
      method: value.method,
      headers: value.headers,
      body: value.body,
      timeoutMs: value.timeoutMs,
      responseType: value.responseType,
      allowHttp: value.allowHttp,
    },
  };
}

export function validateMarketplaceRegistryEntry(value: unknown): ValidationResult<MarketplaceRegistryEntry> {
  if (!isRecord(value)) return { ok: false, error: 'Invalid registry entry' };
  const manifest = validateManifest(value.manifest);
  if (!manifest.ok) return { ok: false, error: `Invalid manifest: ${manifest.error}` };
  if (typeof value.downloadUrl !== 'string' || !value.downloadUrl.trim()) {
    return { ok: false, error: 'Invalid downloadUrl' };
  }
  if (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sha256.trim())) {
    return { ok: false, error: 'Invalid sha256' };
  }
  if (
    value.size !== undefined &&
    (typeof value.size !== 'number' || !Number.isSafeInteger(value.size) || value.size < 0)
  ) {
    return { ok: false, error: 'Invalid package size' };
  }
  if (value.publishedAt !== undefined && typeof value.publishedAt !== 'string') {
    return { ok: false, error: 'Invalid publishedAt' };
  }
  if (
    value.status !== undefined &&
    (typeof value.status !== 'string' || !['active', 'deprecated', 'blocked'].includes(value.status))
  ) {
    return { ok: false, error: 'Invalid plugin status' };
  }
  const provenance = validateMarketplaceProvenance(value.provenance);
  if (!provenance.ok) return provenance;
  if (provenance.data && value.size === undefined) {
    return { ok: false, error: 'Signed packages require an exact package size' };
  }
  if (
    provenance.data &&
    (typeof value.publishedAt !== 'string' || Number.isNaN(Date.parse(value.publishedAt)))
  ) {
    return { ok: false, error: 'Signed packages require a valid publishedAt timestamp' };
  }
  return {
    ok: true,
    data: {
      manifest: manifest.data,
      downloadUrl: value.downloadUrl.trim(),
      sha256: value.sha256.trim().toLowerCase(),
      size: value.size,
      publishedAt: value.publishedAt,
      status: value.status as MarketplaceRegistryEntry['status'],
      provenance: provenance.data,
    },
  };
}

function validateMarketplaceProvenance(
  value: unknown,
): ValidationResult<MarketplacePackageProvenance | undefined> {
  if (value === undefined) return { ok: true, data: undefined };
  if (!isRecord(value) || value.schemaVersion !== 1 || value.algorithm !== 'ed25519') {
    return { ok: false, error: 'Invalid package provenance' };
  }
  if (typeof value.publisher !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(value.publisher)) {
    return { ok: false, error: 'Invalid provenance publisher' };
  }
  if (typeof value.keyId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value.keyId)) {
    return { ok: false, error: 'Invalid provenance keyId' };
  }
  if (typeof value.signature !== 'string' || value.signature.length > 256) {
    return { ok: false, error: 'Invalid provenance signature' };
  }
  let signature: Buffer;
  try {
    signature = Buffer.from(value.signature, 'base64');
  } catch {
    return { ok: false, error: 'Invalid provenance signature' };
  }
  if (signature.length !== 64 || signature.toString('base64') !== value.signature) {
    return { ok: false, error: 'Invalid provenance signature' };
  }
  if (!isRecord(value.source)) return { ok: false, error: 'Invalid provenance source' };
  const repository = value.source.repository;
  const revision = value.source.revision;
  const workflow = value.source.workflow;
  if (typeof repository !== 'string' || !/^https:\/\/[^\s]{1,2040}$/.test(repository)) {
    return { ok: false, error: 'Invalid provenance repository' };
  }
  if (typeof revision !== 'string' || !/^[a-f0-9]{40,64}$/i.test(revision)) {
    return { ok: false, error: 'Invalid provenance revision' };
  }
  if (
    workflow !== undefined &&
    (typeof workflow !== 'string' || !/^https:\/\/[^\s]{1,2040}$/.test(workflow))
  ) {
    return { ok: false, error: 'Invalid provenance workflow' };
  }
  return {
    ok: true,
    data: {
      schemaVersion: 1,
      algorithm: 'ed25519',
      publisher: value.publisher,
      keyId: value.keyId,
      source: { repository, revision: revision.toLowerCase(), workflow },
      signature: value.signature,
    },
  };
}

export function validateMarketplaceRegistry(value: unknown): ValidationResult<MarketplaceRegistry> {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.plugins) ||
    value.plugins.length > 5000
  ) {
    return { ok: false, error: 'Invalid registry payload' };
  }
  const plugins: MarketplaceRegistryEntry[] = [];
  for (const entry of value.plugins) {
    const validated = validateMarketplaceRegistryEntry(entry);
    if (!validated.ok) return validated;
    plugins.push(validated.data);
  }
  return { ok: true, data: { schemaVersion: 1, plugins } };
}
