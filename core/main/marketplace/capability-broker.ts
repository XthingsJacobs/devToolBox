import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DiagnosticEventInput, FileFilter, PluginPermission, PluginSdkResult } from '@devtoolbox/core';
import { ExternalHttpError, requestExternal } from '../ipc/safe-http';
import { isRecord, validateFileFilters, validateHttpRequestParams } from '../ipc/validation';
import type { PluginKvFile } from '../storage/plugin-data';
import type { InstalledPluginRecord, PluginRepository } from './plugin-repository';
import type { PluginTokenStore } from './token-store';

export interface CapabilityPlatform {
  openFiles: (
    owner: unknown,
    options: { filters: FileFilter[]; multiple: boolean },
  ) => Promise<string[] | undefined>;
  saveFile: (
    owner: unknown,
    options: { filters: FileFilter[]; suggestedName: string },
  ) => Promise<string | undefined>;
  openExternal: (url: string) => Promise<void>;
  revealPath: (filePath: string) => void;
  openPath: (filePath: string) => Promise<void>;
  notify: (title: string, body: string) => boolean;
}

export interface CapabilityKvStore {
  read: () => PluginKvFile;
  write: (data: PluginKvFile) => void;
  migrateLegacy: (pluginId: string) => void;
}

export interface CapabilityLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
}

export interface PluginCapabilityBrokerOptions {
  repository: PluginRepository;
  fileTokens: PluginTokenStore;
  kvStore: CapabilityKvStore;
  platform: CapabilityPlatform;
  request?: typeof requestExternal;
  logger?: CapabilityLogger;
  recordDiagnostic?: (event: DiagnosticEventInput) => void;
  runtimeEnabled?: () => boolean;
  debugEnabled?: () => boolean;
  environment?: NodeJS.ProcessEnv;
}

const STORAGE_QUOTA_BYTES = 1024 * 1024;
const FILE_IO_LIMIT_BYTES = 50 * 1024 * 1024;
const DEFAULT_FILTERS: FileFilter[] = [{ name: 'All Files', extensions: ['*'] }];
const FORBIDDEN_STORAGE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function ok<T>(data?: T): PluginSdkResult<T> {
  return { ok: true, data };
}

function err(code: string, message: string, details?: unknown): PluginSdkResult<never> {
  return { ok: false, error: { code, message, details } };
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function validStorageKey(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= 256 && !FORBIDDEN_STORAGE_KEYS.has(value)
  );
}

function normalizeEncoding(value: unknown): 'utf8' | 'base64' | undefined {
  if (value === undefined || value === 'utf8' || value === 'utf-8') return 'utf8';
  if (value === 'base64') return 'base64';
  return undefined;
}

export class PluginCapabilityBroker {
  private readonly request: typeof requestExternal;
  private readonly logger: CapabilityLogger;
  private readonly environment: NodeJS.ProcessEnv;

  constructor(private readonly options: PluginCapabilityBrokerOptions) {
    this.request = options.request ?? requestExternal;
    this.logger = options.logger ?? console;
    this.environment = options.environment ?? process.env;
  }

  log(pluginId: unknown, params: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId);
    if ('ok' in plugin) return plugin;
    const values = isRecord(params) ? params : {};
    const rawLevel = asString(values.level, 'log');
    const level: keyof CapabilityLogger =
      rawLevel === 'debug' || rawLevel === 'info' || rawLevel === 'warn' || rawLevel === 'error'
        ? rawLevel
        : 'log';
    const message = asString(values.message, typeof params === 'string' ? params : '');
    if (!message) return err('invalid_params', 'Log message is required');
    const prefix = `[plugin:${plugin.id}]`;
    const text = message.length > 2000 ? `${message.slice(0, 2000)}...` : message;
    const args = values.data === undefined ? [`${prefix} ${text}`] : [`${prefix} ${text}`, values.data];
    if (level === 'debug' && !this.options.debugEnabled?.()) return ok(true);
    this.options.recordDiagnostic?.({
      level: level === 'log' ? 'info' : level,
      source: 'plugin',
      scope: plugin.id,
      message: text,
      details: values.data,
    });
    this.logger[level](...args);
    return ok(true);
  }

  async httpRequest(pluginId: unknown, params: unknown): Promise<PluginSdkResult> {
    const plugin = this.authorize(pluginId, 'http:proxy', 'http.request');
    if ('ok' in plugin) return plugin;
    const validated = validateHttpRequestParams(params);
    if (!validated.ok) return err('invalid_params', validated.error);
    const { allowHttp: _ignored, ...requestParams } = validated.data;
    try {
      return ok(
        await this.request(requestParams, {
          allowHttp: false,
          allowedDomains: plugin.manifest.httpDomains ?? [],
        }),
      );
    } catch (error) {
      if (error instanceof ExternalHttpError) {
        const code =
          error.code === 'invalid_url' || error.code === 'invalid_protocol' ? 'invalid_params' : error.code;
        return err(code, error.message);
      }
      return err('io_error', error instanceof Error ? error.message : String(error));
    }
  }

  storageGet(pluginId: unknown, key: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'storage:kv', 'storage.get');
    if ('ok' in plugin) return plugin;
    if (!validStorageKey(key)) return err('invalid_params', 'Invalid storage key');
    try {
      const store = this.readPluginStore(plugin.id);
      return ok(Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null);
    } catch (error) {
      return this.ioError(error);
    }
  }

  storageSet(pluginId: unknown, key: unknown, value: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'storage:kv', 'storage.set');
    if ('ok' in plugin) return plugin;
    if (!validStorageKey(key)) return err('invalid_params', 'Invalid storage key');
    try {
      this.options.kvStore.migrateLegacy(plugin.id);
      const kv = this.options.kvStore.read();
      const store = { ...(kv.plugins[plugin.id] ?? {}), [key]: value };
      let serialized: string;
      try {
        serialized = JSON.stringify(store);
      } catch {
        return err('invalid_params', 'Storage value must be JSON serializable');
      }
      if (Buffer.byteLength(serialized, 'utf8') > STORAGE_QUOTA_BYTES) {
        return err('quota_exceeded', 'Plugin storage quota exceeded');
      }
      kv.plugins[plugin.id] = store;
      this.options.kvStore.write(kv);
      return ok(true);
    } catch (error) {
      return this.ioError(error);
    }
  }

  storageDelete(pluginId: unknown, key: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'storage:kv', 'storage.delete');
    if ('ok' in plugin) return plugin;
    if (!validStorageKey(key)) return err('invalid_params', 'Invalid storage key');
    try {
      this.options.kvStore.migrateLegacy(plugin.id);
      const kv = this.options.kvStore.read();
      const store = { ...(kv.plugins[plugin.id] ?? {}) };
      delete store[key];
      kv.plugins[plugin.id] = store;
      this.options.kvStore.write(kv);
      return ok(true);
    } catch (error) {
      return this.ioError(error);
    }
  }

  storageList(pluginId: unknown, prefix: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'storage:kv', 'storage.list');
    if ('ok' in plugin) return plugin;
    if (prefix !== undefined && (typeof prefix !== 'string' || prefix.length > 256)) {
      return err('invalid_params', 'Invalid storage prefix');
    }
    try {
      const keys = Object.keys(this.readPluginStore(plugin.id)).sort();
      return ok(typeof prefix === 'string' && prefix ? keys.filter((key) => key.startsWith(prefix)) : keys);
    } catch (error) {
      return this.ioError(error);
    }
  }

  storageClear(pluginId: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'storage:kv', 'storage.clear');
    if ('ok' in plugin) return plugin;
    try {
      const kv = this.options.kvStore.read();
      delete kv.plugins[plugin.id];
      this.options.kvStore.write(kv);
      return ok(true);
    } catch (error) {
      return this.ioError(error);
    }
  }

  async fsOpenFileDialog(owner: unknown, pluginId: unknown, params: unknown): Promise<PluginSdkResult> {
    const plugin = this.authorize(pluginId, 'fs:dialog', 'fs.openFileDialog');
    if ('ok' in plugin) return plugin;
    if (params !== undefined && !isRecord(params)) return err('invalid_params', 'Invalid dialog parameters');
    const values = isRecord(params) ? params : {};
    if (values.multiple !== undefined && typeof values.multiple !== 'boolean') {
      return err('invalid_params', 'Invalid multiple option');
    }
    const filters = validateFileFilters(values.filters);
    if (!filters.ok) return err('invalid_params', filters.error);
    try {
      const filePaths = await this.options.platform.openFiles(owner, {
        filters: filters.data ?? DEFAULT_FILTERS,
        multiple: values.multiple === true,
      });
      if (!filePaths) return ok({ items: [] });
      return ok({
        items: filePaths.map((filePath) => ({
          fileToken: this.options.fileTokens.issue(plugin.id, filePath),
          name: path.basename(filePath),
        })),
      });
    } catch (error) {
      return this.ioError(error);
    }
  }

  async fsSaveFileDialog(owner: unknown, pluginId: unknown, params: unknown): Promise<PluginSdkResult> {
    const plugin = this.authorize(pluginId, 'fs:dialog', 'fs.saveFileDialog');
    if ('ok' in plugin) return plugin;
    if (params !== undefined && !isRecord(params)) return err('invalid_params', 'Invalid dialog parameters');
    const values = isRecord(params) ? params : {};
    const filters = validateFileFilters(values.filters);
    if (!filters.ok) return err('invalid_params', filters.error);
    if (values.suggestedName !== undefined && typeof values.suggestedName !== 'string') {
      return err('invalid_params', 'Invalid suggestedName');
    }
    const suggestedName =
      path.basename(asString(values.suggestedName, 'output.txt')).slice(0, 255) || 'output.txt';
    try {
      const filePath = await this.options.platform.saveFile(owner, {
        filters: filters.data ?? DEFAULT_FILTERS,
        suggestedName,
      });
      if (!filePath) return ok(null);
      return ok({
        fileToken: this.options.fileTokens.issue(plugin.id, filePath),
        name: path.basename(filePath),
      });
    } catch (error) {
      return this.ioError(error);
    }
  }

  fsReadFile(pluginId: unknown, fileToken: unknown, encoding: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'fs:read', 'fs.readFile');
    if ('ok' in plugin) return plugin;
    if (typeof fileToken !== 'string' || !fileToken) return err('invalid_params', 'Invalid fileToken');
    const normalizedEncoding = normalizeEncoding(encoding);
    if (!normalizedEncoding) return err('invalid_params', 'Unsupported encoding');
    const filePath = this.options.fileTokens.resolve(plugin.id, fileToken);
    if (!filePath) return err('invalid_params', 'Invalid fileToken');
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return err('invalid_params', 'File token does not reference a file');
      if (stat.size > FILE_IO_LIMIT_BYTES) return err('too_large', 'File is too large');
      const content =
        normalizedEncoding === 'base64'
          ? fs.readFileSync(filePath).toString('base64')
          : fs.readFileSync(filePath, 'utf8');
      return ok({ content });
    } catch (error) {
      return this.ioError(error);
    }
  }

  fsWriteFile(pluginId: unknown, fileToken: unknown, content: unknown, encoding: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'fs:write', 'fs.writeFile');
    if ('ok' in plugin) return plugin;
    if (typeof fileToken !== 'string' || !fileToken) return err('invalid_params', 'Invalid fileToken');
    if (typeof content !== 'string') return err('invalid_params', 'File content must be a string');
    const normalizedEncoding = normalizeEncoding(encoding);
    if (!normalizedEncoding) return err('invalid_params', 'Unsupported encoding');
    if (Buffer.byteLength(content, normalizedEncoding) > FILE_IO_LIMIT_BYTES) {
      return err('too_large', 'File content is too large');
    }
    const filePath = this.options.fileTokens.resolve(plugin.id, fileToken);
    if (!filePath) return err('invalid_params', 'Invalid fileToken');
    try {
      fs.writeFileSync(filePath, content, normalizedEncoding);
      return ok(true);
    } catch (error) {
      return this.ioError(error);
    }
  }

  async systemOpenExternal(pluginId: unknown, inputUrl: unknown): Promise<PluginSdkResult> {
    const plugin = this.authorize(pluginId, 'system:openExternal', 'system.openExternal');
    if ('ok' in plugin) return plugin;
    if (typeof inputUrl !== 'string' || !inputUrl || inputUrl.length > 8192) {
      return err('invalid_params', 'Invalid URL');
    }
    let url: URL;
    try {
      url = new URL(inputUrl);
    } catch {
      return err('invalid_params', 'Invalid URL');
    }
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      return err('invalid_params', 'Unsupported URL');
    }
    try {
      await this.options.platform.openExternal(url.toString());
      return ok(true);
    } catch (error) {
      return this.ioError(error);
    }
  }

  systemRevealPath(pluginId: unknown, pathToken: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'system:revealPath', 'system.revealPath');
    if ('ok' in plugin) return plugin;
    const filePath = this.resolvePathToken(plugin.id, pathToken);
    if (!filePath) return err('invalid_params', 'Invalid pathToken');
    try {
      this.options.platform.revealPath(filePath);
      return ok(true);
    } catch (error) {
      return this.ioError(error);
    }
  }

  async systemOpenPath(pluginId: unknown, pathToken: unknown): Promise<PluginSdkResult> {
    const plugin = this.authorize(pluginId, 'system:openPath', 'system.openPath');
    if ('ok' in plugin) return plugin;
    const filePath = this.resolvePathToken(plugin.id, pathToken);
    if (!filePath) return err('invalid_params', 'Invalid pathToken');
    try {
      await this.options.platform.openPath(filePath);
      return ok(true);
    } catch (error) {
      return this.ioError(error);
    }
  }

  systemNotify(pluginId: unknown, params: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'system:notifications', 'system.notify');
    if ('ok' in plugin) return plugin;
    if (params !== undefined && !isRecord(params))
      return err('invalid_params', 'Invalid notification parameters');
    const values = isRecord(params) ? params : {};
    if (
      (values.title !== undefined && typeof values.title !== 'string') ||
      (values.body !== undefined && typeof values.body !== 'string')
    ) {
      return err('invalid_params', 'Invalid notification parameters');
    }
    const title = asString(values.title, 'DevToolBox').slice(0, 200);
    const body = asString(values.body).slice(0, 2000);
    try {
      if (!this.options.platform.notify(title, body)) {
        return err('not_supported', 'Notifications not supported');
      }
      return ok(true);
    } catch (error) {
      return this.ioError(error);
    }
  }

  systemGetInfo(pluginId: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'system:getInfo', 'system.getInfo');
    if ('ok' in plugin) return plugin;
    return ok({
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      hostname: os.hostname(),
      node: process.versions.node,
      electron: process.versions.electron,
    });
  }

  systemGetEnv(pluginId: unknown, keys: unknown): PluginSdkResult {
    const plugin = this.authorize(pluginId, 'system:env:read', 'system.getEnv');
    if ('ok' in plugin) return plugin;
    if (!Array.isArray(keys) || keys.length > 100 || keys.some((key) => typeof key !== 'string')) {
      return err('invalid_params', 'Invalid environment keys');
    }
    const allowlist = new Set(plugin.manifest.envAllowlist ?? []);
    const values: Record<string, string | undefined> = {};
    for (const key of keys as string[]) {
      if (allowlist.has(key)) values[key] = this.environment[key];
    }
    return ok(values);
  }

  private authorize(
    pluginId: unknown,
    permission?: PluginPermission,
    method?: string,
  ): InstalledPluginRecord | PluginSdkResult<never> {
    if (this.options.runtimeEnabled && !this.options.runtimeEnabled()) {
      return err('safe_mode', 'Plugin capabilities are unavailable in safe mode');
    }
    const plugin = this.options.repository.get(pluginId);
    if (!plugin) return err('not_installed', 'Plugin not installed');
    if (!plugin.enabled) return err('plugin_disabled', 'Plugin is disabled');
    if (permission && !plugin.manifest.permissions.includes(permission)) {
      return err(
        'permission_denied',
        method ? `Missing permission "${permission}" for ${method}` : `Missing permission: ${permission}`,
        {
          pluginId: plugin.id,
          method,
          permission,
          manifestField: 'permissions',
          suggestedFix: `Add "${permission}" to manifest.permissions for ${plugin.id}.`,
        },
      );
    }
    return plugin;
  }

  private readPluginStore(pluginId: string): Record<string, unknown> {
    this.options.kvStore.migrateLegacy(pluginId);
    return this.options.kvStore.read().plugins[pluginId] ?? {};
  }

  private resolvePathToken(pluginId: string, token: unknown): string | undefined {
    if (typeof token !== 'string' || !token) return undefined;
    return this.options.fileTokens.resolve(pluginId, token);
  }

  private ioError(error: unknown): PluginSdkResult<never> {
    return err('io_error', error instanceof Error ? error.message : String(error));
  }
}
