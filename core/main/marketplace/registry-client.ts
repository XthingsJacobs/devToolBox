import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MarketplaceRegistry, MarketplaceRegistryResult } from '@devtoolbox/core';
import { isForbiddenHostLiteral, requestExternal, type ExternalHttpResult } from '../ipc/safe-http';
import { validateMarketplaceRegistry } from '../ipc/validation';
import { readJsonFile, writeJsonAtomic } from '../storage/atomic-json';

type RegistryCache = {
  url: string;
  fetchedAt: number;
  etag?: string;
  lastModified?: string;
  registry: MarketplaceRegistry;
};

export interface RegistryClientOptions {
  cacheDir: string;
  isDevelopment: boolean;
  userAgent: string;
  force?: boolean;
  now?: () => number;
  request?: typeof requestExternal;
  debug?: (message: string, extra?: Record<string, unknown>) => void;
}

const REGISTRY_MAX_BYTES = 2 * 1024 * 1024;
const REGISTRY_TTL_MS = 6 * 60 * 60 * 1000;

function readCache(cachePath: string): RegistryCache | undefined {
  const value = readJsonFile(cachePath);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const registry = validateMarketplaceRegistry(record.registry);
  if (
    !registry.ok ||
    typeof record.url !== 'string' ||
    typeof record.fetchedAt !== 'number' ||
    !Number.isFinite(record.fetchedAt)
  ) {
    return undefined;
  }
  return {
    url: record.url,
    fetchedAt: record.fetchedAt,
    etag: typeof record.etag === 'string' ? record.etag : undefined,
    lastModified: typeof record.lastModified === 'string' ? record.lastModified : undefined,
    registry: registry.data,
  };
}

function parseRegistry(data: unknown): MarketplaceRegistryResult {
  try {
    const value = typeof data === 'string' ? (JSON.parse(data) as unknown) : data;
    const validated = validateMarketplaceRegistry(value);
    if (!validated.ok) return { success: false, error: validated.error };
    return { success: true, registry: validated.data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function responseError(response: ExternalHttpResult): string {
  const details = typeof response.data === 'string' ? response.data.slice(0, 300) : '';
  return `HTTP ${response.status}${details ? `: ${details}` : ''}`;
}

export async function fetchMarketplaceRegistry(
  inputUrl: unknown,
  options: RegistryClientOptions,
): Promise<MarketplaceRegistryResult> {
  const debug = options.debug ?? (() => undefined);
  const now = options.now ?? Date.now;
  const request = options.request ?? requestExternal;
  const force = options.force === true;

  if (typeof inputUrl !== 'string' || !inputUrl.trim() || inputUrl.length > 8192) {
    return { success: false, error: 'Invalid registry URL' };
  }

  let url: URL;
  try {
    url = new URL(inputUrl.trim());
  } catch {
    return { success: false, error: 'Invalid registry URL' };
  }

  if (url.protocol === 'file:') {
    if (!options.isDevelopment) return { success: false, error: 'Only https is allowed' };
    try {
      const filePath = fileURLToPath(url);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return { success: false, error: 'Registry path is not a file' };
      if (stat.size > REGISTRY_MAX_BYTES) return { success: false, error: 'Registry file too large' };
      debug('registry:file:read', { path: filePath, size: stat.size });
      return parseRegistry(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: false, error: 'Registry file not found' };
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (url.protocol !== 'https:') return { success: false, error: 'Only https is allowed' };
  if (isForbiddenHostLiteral(url.hostname)) return { success: false, error: 'Forbidden target' };

  const canonicalUrl = url.toString();
  const cacheKey = crypto.createHash('sha256').update(canonicalUrl).digest('hex');
  const cachePath = path.join(options.cacheDir, `${cacheKey}.json`);
  const cached = readCache(cachePath);
  if (!force && cached && now() - cached.fetchedAt < REGISTRY_TTL_MS) {
    debug('registry:cache:hit', { cachePath });
    return { success: true, registry: cached.registry };
  }

  const headers: Record<string, string> = {
    'user-agent': options.userAgent,
    accept: 'application/json, text/plain, */*',
  };
  if (cached?.etag) headers['if-none-match'] = cached.etag;
  if (cached?.lastModified) headers['if-modified-since'] = cached.lastModified;
  if (force) {
    headers['cache-control'] = 'no-cache';
    headers.pragma = 'no-cache';
  }

  const requestUrl = new URL(canonicalUrl);
  if (force) requestUrl.searchParams.set('_', String(now()));
  debug('registry:fetch:start', { url: canonicalUrl });

  try {
    const response = await request(
      { url: requestUrl.toString(), headers, timeoutMs: 30_000, responseType: 'text' },
      { maxBytes: REGISTRY_MAX_BYTES },
    );
    if (response.status === 304 && cached) {
      writeJsonAtomic(cachePath, { ...cached, fetchedAt: now() });
      debug('registry:not-modified', { url: canonicalUrl });
      return { success: true, registry: cached.registry };
    }
    if (response.status < 200 || response.status >= 300) {
      debug('registry:fetch:failed', { url: canonicalUrl, status: response.status });
      if (cached) return { success: true, registry: cached.registry };
      return { success: false, error: responseError(response) };
    }

    const parsed = parseRegistry(response.data);
    if (!parsed.success) return parsed;
    writeJsonAtomic(cachePath, {
      url: canonicalUrl,
      fetchedAt: now(),
      etag: response.headers.etag,
      lastModified: response.headers['last-modified'],
      registry: parsed.registry,
    } satisfies RegistryCache);
    debug('registry:fetch:ok', { url: canonicalUrl, cachePath });
    return parsed;
  } catch (error) {
    debug('registry:fetch:error', {
      url: canonicalUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    if (cached) return { success: true, registry: cached.registry };
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
