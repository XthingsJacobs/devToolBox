export const PLUGIN_PERMISSIONS = [
  'http:external',
  'http:proxy',
  'fs:dialog',
  'fs:read',
  'fs:write',
  'storage:kv',
  'bluetooth',
  'serial',
  'usb',
  'system:openExternal',
  'system:revealPath',
  'system:openPath',
  'system:notifications',
  'system:env:read',
  'system:getInfo',
] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

export const SUPPORTED_PLUGIN_SDK_VERSIONS = ['1.0'] as const;

export const PLUGIN_SDK_METHODS = [
  'http.request',
  'storage.get',
  'storage.set',
  'storage.delete',
  'storage.list',
  'storage.clear',
  'fs.openFileDialog',
  'fs.saveFileDialog',
  'fs.readFile',
  'fs.writeFile',
  'system.openExternal',
  'system.revealPath',
  'system.openPath',
  'system.notify',
  'system.getInfo',
  'system.getEnv',
  'log.debug',
  'log.info',
  'log.warn',
  'log.error',
  'log.log',
] as const;

export type PluginSdkMethod = (typeof PLUGIN_SDK_METHODS)[number];

export type PluginSdkError = { code: string; message: string; details?: unknown };

export type PluginSdkResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: PluginSdkError };

export type PluginSdkRequest = {
  type: 'devtoolbox:sdk:request';
  requestId: string;
  pluginId?: string;
  method: PluginSdkMethod;
  params?: unknown;
};

export type PluginSdkResponse =
  | { type: 'devtoolbox:sdk:response'; requestId: string; ok: true; data?: unknown }
  | {
      type: 'devtoolbox:sdk:response';
      requestId: string;
      ok: false;
      error: PluginSdkError;
    };

export interface MarketplacePluginManifest {
  id: string;
  name: string;
  description: string;
  i18n?: Partial<Record<'en' | 'zh-CN', { name?: string; description?: string }>>;
  version: string;
  sdkVersion: string;
  entry: string;
  categoryId: string;
  author: string;
  icon?: string;
  iconKey?: string;
  license: string;
  homepage: string;
  repository: string;
  permissions: PluginPermission[];
  httpDomains?: string[];
  tags?: string[];
  keywords?: string[];
  minAppVersion?: string;
  maintainers?: string[];
  envAllowlist?: string[];
  deprecated?: boolean;
  replacedBy?: string;
}

export interface MarketplaceProvenanceSource {
  repository: string;
  revision: string;
  workflow?: string;
}

export interface MarketplacePackageProvenance {
  schemaVersion: 1;
  algorithm: 'ed25519';
  publisher: string;
  keyId: string;
  source: MarketplaceProvenanceSource;
  signature: string;
}

export type MarketplaceProvenanceStatus = 'verified' | 'untrusted' | 'unsigned';

export interface MarketplaceInstalledProvenance {
  status: MarketplaceProvenanceStatus;
  publisher?: string;
  keyId?: string;
  source?: MarketplaceProvenanceSource;
}

export interface MarketplaceRegistryEntry {
  manifest: MarketplacePluginManifest;
  downloadUrl: string;
  sha256: string;
  size?: number;
  publishedAt?: string;
  status?: 'active' | 'deprecated' | 'blocked';
  provenance?: MarketplacePackageProvenance;
}

export interface MarketplaceRegistry {
  schemaVersion: number;
  plugins: MarketplaceRegistryEntry[];
}

export interface InstalledMarketplacePlugin {
  id: string;
  version: string;
  enabled: boolean;
  installedAt: string;
  entryUrl: string;
  manifest: MarketplacePluginManifest;
  provenance?: MarketplaceInstalledProvenance;
}

export type * from './electron-api';
