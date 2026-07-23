import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { readJsonFile, writeJsonAtomic } from './atomic-json';

export type PluginKvFile = { schemaVersion: 1; plugins: Record<string, Record<string, unknown>> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pluginKvPath(): string {
  return path.join(app.getPath('userData'), 'plugin-kv.json');
}

function marketplaceStatePath(): string {
  return path.join(app.getPath('userData'), 'marketplace-state.json');
}

export function readPluginKv(): PluginKvFile {
  const raw = readJsonFile(pluginKvPath());
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !isRecord(raw.plugins)) {
    return { schemaVersion: 1, plugins: {} };
  }

  const plugins: Record<string, Record<string, unknown>> = {};
  for (const [pluginId, store] of Object.entries(raw.plugins)) {
    if (isRecord(store)) plugins[pluginId] = store;
  }
  return { schemaVersion: 1, plugins };
}

export function writePluginKv(data: PluginKvFile): void {
  writeJsonAtomic(pluginKvPath(), data);
}

export function migrateLegacyPluginKv(pluginId: string): void {
  const legacyPath = path.join(app.getPath('userData'), 'plugins', pluginId, 'store.json');
  if (!fs.existsSync(legacyPath)) return;
  const legacy = readJsonFile(legacyPath);
  if (!isRecord(legacy)) return;
  const kv = readPluginKv();
  kv.plugins[pluginId] = { ...legacy, ...(kv.plugins[pluginId] ?? {}) };
  writePluginKv(kv);
  try {
    fs.rmSync(legacyPath, { force: true });
  } catch {
    return;
  }
}

export function deletePluginKv(pluginId: string): void {
  const kv = readPluginKv();
  if (!(pluginId in kv.plugins)) return;
  delete kv.plugins[pluginId];
  writePluginKv(kv);
}

export function readMarketplaceState(): unknown {
  return readJsonFile(marketplaceStatePath());
}

export function writeMarketplaceState(data: unknown): void {
  writeJsonAtomic(marketplaceStatePath(), data);
}
