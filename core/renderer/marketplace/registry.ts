import type { MarketplaceRegistry } from './types';
import registryData from './registry.json';

export function getBundledRegistry(): MarketplaceRegistry {
  return registryData as MarketplaceRegistry;
}

export const DEFAULT_MARKETPLACE_REGISTRY_URL =
  'https://github.com/XthingsJacobs/devToolBox/releases/download/marketplace/registry.json';

const REGISTRY_URL_KEY = 'devtoolbox_marketplace_registry_url';

export const ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL = import.meta.env.DEV;

export function loadMarketplaceRegistryUrl(): string {
  if (!ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL) return '';
  try {
    return localStorage.getItem(REGISTRY_URL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveMarketplaceRegistryUrl(url: string): void {
  if (!ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL) return;
  const v = String(url ?? '').trim();
  try {
    if (!v) localStorage.removeItem(REGISTRY_URL_KEY);
    else localStorage.setItem(REGISTRY_URL_KEY, v);
  } catch {
    return;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isMarketplaceRegistry(v: unknown): v is MarketplaceRegistry {
  if (!isRecord(v)) return false;
  if (typeof v.schemaVersion !== 'number') return false;
  if (!Array.isArray(v.plugins)) return false;
  return true;
}

export async function fetchMarketplaceRegistry(url: string, options?: { force?: boolean }): Promise<MarketplaceRegistry> {
  const api = window.electronAPI;
  if (!api?.marketplaceFetchRegistry) throw new Error('marketplaceFetchRegistry not available');
  const res = await api.marketplaceFetchRegistry(url, options);
  if (!res?.success) throw new Error(res?.error ?? 'Failed to fetch registry');
  if (!isMarketplaceRegistry(res.registry)) throw new Error('Invalid registry payload');
  return res.registry;
}
