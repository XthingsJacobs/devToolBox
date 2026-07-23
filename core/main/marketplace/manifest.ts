import {
  PLUGIN_PERMISSIONS,
  SUPPORTED_PLUGIN_SDK_VERSIONS,
  type MarketplacePluginManifest,
  type PluginPermission,
} from '@devtoolbox/core';
import { isForbiddenHostLiteral } from '../ipc/safe-http';

type ManifestValidationResult = { ok: true; data: MarketplacePluginManifest } | { ok: false; error: string };

const permissionSet = new Set<string>(PLUGIN_PERMISSIONS);
const sdkVersionSet = new Set<string>(SUPPORTED_PLUGIN_SDK_VERSIONS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = value.filter((item): item is string => typeof item === 'string');
  out.sort();
  return Array.from(new Set(out));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isSafeVersion(value: string): boolean {
  return /^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/.test(value) && value !== '.' && value !== '..';
}

function isSafeEntry(value: string): boolean {
  if (!value || value.startsWith('/') || value.includes('\\')) return false;
  const segments = value.split('/');
  return segments.every(
    (segment) => segment !== '.' && segment !== '..' && /^[0-9A-Za-z_@+.-]+$/.test(segment),
  );
}

export function validateHttpDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.includes('://') || domain.includes('/')) return false;
  if (domain === '*' || domain.includes('**')) return false;
  if (domain.includes('*') && !domain.startsWith('*.')) return false;
  if (domain.startsWith('*.') && domain.slice(2).includes('*')) return false;
  const host = domain.startsWith('*.') ? domain.slice(2) : domain;
  if (!host.includes('.') || isForbiddenHostLiteral(host)) return false;
  return /^[a-z0-9.*-]+$/.test(domain.toLowerCase());
}

export function validateManifest(manifest: unknown): ManifestValidationResult {
  if (!isRecord(manifest)) return { ok: false, error: 'manifest is not an object' };

  const id = manifest.id;
  const name = manifest.name;
  const description = manifest.description;
  const version = manifest.version;
  const sdkVersion = manifest.sdkVersion;
  const entry = manifest.entry;
  const categoryId = manifest.categoryId;
  const author = manifest.author;
  const license = manifest.license;
  const homepage = manifest.homepage;
  const repository = manifest.repository;
  const rawPermissions = normalizeStringArray(manifest.permissions);

  if (typeof id !== 'string' || !/^market-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
    return { ok: false, error: 'invalid id' };
  if (typeof name !== 'string' || !name.trim()) return { ok: false, error: 'invalid name' };
  if (typeof description !== 'string') return { ok: false, error: 'invalid description' };
  if (typeof version !== 'string' || !isSafeVersion(version.trim())) {
    return { ok: false, error: 'invalid version' };
  }
  if (typeof sdkVersion !== 'string' || !sdkVersionSet.has(sdkVersion))
    return { ok: false, error: 'unsupported sdkVersion' };
  if (typeof entry !== 'string' || !isSafeEntry(entry.trim())) return { ok: false, error: 'invalid entry' };
  if (typeof categoryId !== 'string' || !categoryId.trim()) return { ok: false, error: 'invalid categoryId' };
  if (typeof author !== 'string' || !author.trim()) return { ok: false, error: 'invalid author' };
  if (typeof license !== 'string' || !license.trim()) return { ok: false, error: 'invalid license' };
  if (typeof homepage !== 'string' || !homepage.trim()) return { ok: false, error: 'invalid homepage' };
  if (typeof repository !== 'string' || !repository.trim()) return { ok: false, error: 'invalid repository' };
  if (!rawPermissions.length) return { ok: false, error: 'permissions is empty' };
  if (rawPermissions.some((permission) => !permissionSet.has(permission)))
    return { ok: false, error: 'unsupported permission' };
  const permissions = rawPermissions as PluginPermission[];

  const httpDomains = normalizeStringArray(manifest.httpDomains);
  if (
    (permissions.includes('http:external') || permissions.includes('http:proxy')) &&
    httpDomains.length === 0
  ) {
    return { ok: false, error: 'httpDomains is required for network access' };
  }
  if (httpDomains.some((domain) => !validateHttpDomain(domain)))
    return { ok: false, error: 'invalid httpDomains' };

  const envAllowlist = normalizeStringArray(manifest.envAllowlist);
  if (permissions.includes('system:env:read') && envAllowlist.length === 0) {
    return { ok: false, error: 'envAllowlist is required when system:env:read is present' };
  }

  const i18n = (() => {
    if (!isRecord(manifest.i18n)) return undefined;
    const out: Partial<Record<'en' | 'zh-CN', { name?: string; description?: string }>> = {};
    for (const locale of ['en', 'zh-CN'] as const) {
      const localized = manifest.i18n[locale];
      if (!isRecord(localized)) continue;
      const localizedName = optionalString(localized.name);
      const localizedDescription =
        typeof localized.description === 'string' ? localized.description : undefined;
      if (localizedName || localizedDescription !== undefined) {
        out[locale] = { name: localizedName, description: localizedDescription };
      }
    }
    return Object.keys(out).length ? out : undefined;
  })();

  return {
    ok: true,
    data: {
      id,
      name: name.trim(),
      description,
      i18n,
      version: version.trim(),
      sdkVersion,
      entry: entry.trim(),
      categoryId: categoryId.trim(),
      author: author.trim(),
      icon: optionalString(manifest.icon),
      iconKey: optionalString(manifest.iconKey),
      license: license.trim(),
      homepage: homepage.trim(),
      repository: repository.trim(),
      permissions,
      httpDomains: httpDomains.length ? httpDomains : undefined,
      tags: normalizeStringArray(manifest.tags),
      keywords: normalizeStringArray(manifest.keywords),
      minAppVersion: optionalString(manifest.minAppVersion),
      maintainers: normalizeStringArray(manifest.maintainers),
      envAllowlist: envAllowlist.length ? envAllowlist : undefined,
      deprecated: typeof manifest.deprecated === 'boolean' ? manifest.deprecated : undefined,
      replacedBy: optionalString(manifest.replacedBy),
    },
  };
}

export function compareManifests(
  registryManifest: MarketplacePluginManifest,
  packageManifest: MarketplacePluginManifest,
): string[] {
  const errors: string[] = [];
  for (const field of [
    'id',
    'version',
    'sdkVersion',
    'entry',
    'categoryId',
    'author',
    'license',
    'homepage',
    'repository',
  ] as const) {
    if (registryManifest[field] !== packageManifest[field]) errors.push(`${field} mismatch`);
  }
  if (JSON.stringify(registryManifest.i18n ?? null) !== JSON.stringify(packageManifest.i18n ?? null))
    errors.push('i18n mismatch');

  for (const field of ['permissions', 'httpDomains', 'envAllowlist'] as const) {
    const registryValues = normalizeStringArray(registryManifest[field]);
    const packageValues = normalizeStringArray(packageManifest[field]);
    if (registryValues.join('|') !== packageValues.join('|')) errors.push(`${field} mismatch`);
  }
  return errors;
}
