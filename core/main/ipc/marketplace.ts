import { app, ipcMain } from 'electron';
import path from 'node:path';
import type { DiagnosticEventInput } from '@devtoolbox/core';
import { PluginCapabilityBroker } from '../marketplace/capability-broker';
import { PluginInstaller } from '../marketplace/plugin-installer';
import { isPluginId, pluginRepository } from '../marketplace/plugin-repository';
import { parseMarketplaceTrustConfig } from '../marketplace/provenance';
import { fetchMarketplaceRegistry } from '../marketplace/registry-client';
import { PluginTokenStore } from '../marketplace/token-store';
import trustedPublisherConfig from '../marketplace/trusted-publishers.json';
import { pluginEntryUrl } from '../protocols/plugin-protocol';
import { deletePluginKv, migrateLegacyPluginKv, readPluginKv, writePluginKv } from '../storage/plugin-data';
import { isRecord } from './validation';
import { createElectronCapabilityPlatform, registerPluginCapabilityIpc } from './plugin-capabilities';

function isDebugEnabled(): boolean {
  const value = String(process.env.DEVTOOLBOX_DEBUG ?? '')
    .trim()
    .toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function debug(message: string, extra?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  const payload = extra ? ` ${JSON.stringify(extra)}` : '';
  process.stdout.write(`[marketplace] ${message}${payload}\n`);
}

export function register(
  recordDiagnostic?: (event: DiagnosticEventInput) => void,
  pluginsAllowed: () => boolean = () => true,
): void {
  const userDataDir = app.getPath('userData');
  const fileTokens = new PluginTokenStore();
  const parsedTrust = parseMarketplaceTrustConfig(trustedPublisherConfig);
  if (!parsedTrust.ok) throw new Error(parsedTrust.error);
  const configuredMode = process.env.DEVTOOLBOX_MARKETPLACE_PROVENANCE_POLICY;
  const provenancePolicy = {
    ...parsedTrust.policy,
    mode: configuredMode === 'strict' ? configuredMode : parsedTrust.policy.mode,
  };
  const installer = new PluginInstaller({
    repository: pluginRepository,
    installBaseDir: path.join(userDataDir, 'modules'),
    zipCacheDir: path.join(userDataDir, 'marketplace-cache', 'zips'),
    tempDir: app.getPath('temp'),
    pluginDataBaseDir: path.join(userDataDir, 'plugins'),
    isDevelopment: Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged,
    userAgent: `DevToolBox/${app.getVersion()} (${process.platform}; ${process.arch})`,
    clearFileTokens: (pluginId) => fileTokens.clear(pluginId),
    clearPluginData: deletePluginKv,
    provenancePolicy,
    recordDiagnostic,
    debug,
  });
  const capabilityBroker = new PluginCapabilityBroker({
    repository: pluginRepository,
    fileTokens,
    kvStore: {
      read: readPluginKv,
      write: writePluginKv,
      migrateLegacy: migrateLegacyPluginKv,
    },
    platform: createElectronCapabilityPlatform(),
    recordDiagnostic,
    runtimeEnabled: pluginsAllowed,
    debugEnabled: isDebugEnabled,
  });

  ipcMain.handle('marketplace:fetchRegistry', (_event, url: unknown, rawOptions: unknown) => {
    if (
      rawOptions !== undefined &&
      (!isRecord(rawOptions) || (rawOptions.force !== undefined && typeof rawOptions.force !== 'boolean'))
    ) {
      return { success: false, error: 'Invalid registry options' };
    }
    return fetchMarketplaceRegistry(url, {
      cacheDir: path.join(userDataDir, 'marketplace-cache', 'registries'),
      isDevelopment: Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged,
      userAgent: `DevToolBox/${app.getVersion()} (${process.platform}; ${process.arch})`,
      force: isRecord(rawOptions) ? rawOptions.force === true : false,
      debug,
    });
  });

  ipcMain.handle('marketplace:listInstalled', () =>
    pluginRepository.list().map((record) => ({
      id: record.id,
      version: record.version,
      enabled: record.enabled,
      installedAt: record.installedAt,
      entryUrl: `${pluginEntryUrl(record.manifest)}?v=${encodeURIComponent(record.installedAt)}`,
      manifest: record.manifest,
      provenance: record.provenance,
    })),
  );

  ipcMain.handle('marketplace:setEnabled', (_event, id: unknown, enabled: unknown) => {
    if (!isPluginId(id) || typeof enabled !== 'boolean') {
      return { success: false, error: 'Invalid parameters' };
    }
    try {
      if (!pluginRepository.setEnabled(id, enabled)) {
        return { success: false, error: 'Plugin not installed' };
      }
      if (!enabled) fileTokens.clear(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('marketplace:uninstall', (_event, id: unknown) => installer.uninstall(id));
  ipcMain.handle('marketplace:install', (_event, entry: unknown) => installer.install(entry));
  registerPluginCapabilityIpc(capabilityBroker);
}
