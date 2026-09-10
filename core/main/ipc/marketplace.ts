import { app, ipcMain, dialog, shell, Notification, BrowserWindow, type FileFilter, type OpenDialogOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import net from 'net';
import dgram from 'dgram';
import { fileURLToPath, pathToFileURL } from 'url';
import extract from 'extract-zip';

type PluginPermission =
  | 'http:external'
  | 'http:proxy'
  | 'fs:dialog'
  | 'fs:read'
  | 'fs:write'
  | 'storage:kv'
  | 'net:socket'
  | 'bluetooth'
  | 'serial'
  | 'usb'
  | 'system:openExternal'
  | 'system:revealPath'
  | 'system:openPath'
  | 'system:notifications'
  | 'system:env:read'
  | 'system:getInfo';

interface MarketplacePluginManifest {
  id: string;
  name: string;
  description: string;
  i18n?: Partial<Record<'en' | 'zh-CN', { name?: string; description?: string }>>;
  version: string;
  sdkVersion: string;
  entry: string;
  categoryId: string;
  author: string;
  license: string;
  homepage: string;
  repository: string;
  permissions: PluginPermission[];
  httpDomains?: string[];
  envAllowlist?: string[];
}

interface MarketplaceRegistryEntry {
  manifest: MarketplacePluginManifest;
  downloadUrl: string;
  sha256: string;
  size?: number;
  publishedAt?: string;
  status?: 'active' | 'deprecated' | 'blocked';
}

interface InstalledPluginRecord {
  id: string;
  version: string;
  enabled: boolean;
  installedAt: string;
  manifest: MarketplacePluginManifest;
}

interface MarketplaceState {
  installed: Record<string, InstalledPluginRecord>;
}

function isDebugEnabled(): boolean {
  const v = String(process.env.DEVTOOLBOX_DEBUG ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function dbg(scope: string, message: string, extra?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  const payload = extra ? ` ${JSON.stringify(extra)}` : '';
  process.stdout.write(`[${scope}] ${message}${payload}\n`);
}

function isKebabCaseId(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out = v.filter((x): x is string => typeof x === 'string');
  out.sort();
  return Array.from(new Set(out));
}

function validateHttpDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.includes('://')) return false;
  if (domain.includes('/')) return false;
  if (domain === '*') return false;
  if (domain.includes('**')) return false;
  if (domain.includes('*') && !domain.startsWith('*.')) return false;
  if (domain.startsWith('*.') && domain.slice(2).includes('*')) return false;
  const host = domain.startsWith('*.') ? domain.slice(2) : domain;
  if (!host.includes('.')) return false;
  if (isForbiddenTarget(host)) return false;
  return /^[a-z0-9.*-]+$/.test(domain.toLowerCase());
}

function validateManifest(manifest: unknown): { ok: true; data: MarketplacePluginManifest } | { ok: false; error: string } {
  if (!isRecord(manifest)) return { ok: false, error: 'manifest is not an object' };
  const id = manifest.id;
  const name = manifest.name;
  const description = manifest.description;
  const i18n = (() => {
    const raw = (manifest as Record<string, unknown>).i18n;
    if (!isRecord(raw)) return undefined;
    const out: Partial<Record<'en' | 'zh-CN', { name?: string; description?: string }>> = {};
    for (const loc of ['en', 'zh-CN'] as const) {
      const v = raw[loc];
      if (!isRecord(v)) continue;
      const n = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : undefined;
      const d = typeof v.description === 'string' ? v.description : undefined;
      if (n || d) out[loc] = { name: n, description: d };
    }
    return Object.keys(out).length ? out : undefined;
  })();
  const version = manifest.version;
  const sdkVersion = manifest.sdkVersion;
  const entry = manifest.entry;
  const categoryId = manifest.categoryId;
  const author = manifest.author;
  const license = manifest.license;
  const homepage = manifest.homepage;
  const repository = manifest.repository;
  const permissions = normalizeStringArray(manifest.permissions) as PluginPermission[];

  if (typeof id !== 'string' || !isKebabCaseId(id) || !id.startsWith('market-')) return { ok: false, error: 'invalid id' };
  if (typeof name !== 'string' || !name.trim()) return { ok: false, error: 'invalid name' };
  if (typeof description !== 'string') return { ok: false, error: 'invalid description' };
  if (typeof version !== 'string' || !version.trim()) return { ok: false, error: 'invalid version' };
  if (typeof sdkVersion !== 'string' || !sdkVersion.trim()) return { ok: false, error: 'invalid sdkVersion' };
  if (typeof entry !== 'string' || !entry.trim()) return { ok: false, error: 'invalid entry' };
  if (typeof categoryId !== 'string' || !categoryId.trim()) return { ok: false, error: 'invalid categoryId' };
  if (typeof author !== 'string' || !author.trim()) return { ok: false, error: 'invalid author' };
  if (typeof license !== 'string' || !license.trim()) return { ok: false, error: 'invalid license' };
  if (typeof homepage !== 'string' || !homepage.trim()) return { ok: false, error: 'invalid homepage' };
  if (typeof repository !== 'string' || !repository.trim()) return { ok: false, error: 'invalid repository' };
  if (!permissions.length) return { ok: false, error: 'permissions is empty' };

  const httpDomains = normalizeStringArray(manifest.httpDomains);
  if (permissions.includes('http:external' as PluginPermission) && httpDomains.length === 0) {
    return { ok: false, error: 'httpDomains is required when http:external is present' };
  }
  if (httpDomains.length && httpDomains.some((d) => !validateHttpDomain(d))) return { ok: false, error: 'invalid httpDomains' };

  const envAllowlist = normalizeStringArray(manifest.envAllowlist);
  if (permissions.includes('system:env:read' as PluginPermission) && envAllowlist.length === 0) {
    return { ok: false, error: 'envAllowlist is required when system:env:read is present' };
  }

  const out: MarketplacePluginManifest = {
    id,
    name,
    description,
    i18n,
    version,
    sdkVersion,
    entry,
    categoryId,
    author,
    license,
    homepage,
    repository,
    permissions,
    httpDomains: httpDomains.length ? httpDomains : undefined,
    envAllowlist: envAllowlist.length ? envAllowlist : undefined,
  };
  return { ok: true, data: out };
}

function compareManifests(registryManifest: MarketplacePluginManifest, packageManifest: MarketplacePluginManifest): string[] {
  const errors: string[] = [];
  if (registryManifest.id !== packageManifest.id) errors.push('id mismatch');
  if (registryManifest.version !== packageManifest.version) errors.push('version mismatch');
  if (registryManifest.sdkVersion !== packageManifest.sdkVersion) errors.push('sdkVersion mismatch');
  if (registryManifest.entry !== packageManifest.entry) errors.push('entry mismatch');
  if (registryManifest.categoryId !== packageManifest.categoryId) errors.push('categoryId mismatch');
  if (registryManifest.author !== packageManifest.author) errors.push('author mismatch');
  if (registryManifest.license !== packageManifest.license) errors.push('license mismatch');
  if (registryManifest.homepage !== packageManifest.homepage) errors.push('homepage mismatch');
  if (registryManifest.repository !== packageManifest.repository) errors.push('repository mismatch');
  if (JSON.stringify(registryManifest.i18n ?? null) !== JSON.stringify(packageManifest.i18n ?? null)) errors.push('i18n mismatch');

  const a = normalizeStringArray(registryManifest.permissions);
  const b = normalizeStringArray(packageManifest.permissions);
  if (a.join('|') !== b.join('|')) errors.push('permissions mismatch');

  const da = normalizeStringArray(registryManifest.httpDomains);
  const db = normalizeStringArray(packageManifest.httpDomains);
  if (da.join('|') !== db.join('|')) errors.push('httpDomains mismatch');

  const ea = normalizeStringArray(registryManifest.envAllowlist);
  const eb = normalizeStringArray(packageManifest.envAllowlist);
  if (ea.join('|') !== eb.join('|')) errors.push('envAllowlist mismatch');

  return errors;
}

function getStatePath(): string {
  return path.join(app.getPath('userData'), 'marketplace-state.json');
}

function getInstallBaseDir(): string {
  return path.join(app.getPath('userData'), 'modules');
}

function getRegistryCacheDir(): string {
  return path.join(app.getPath('userData'), 'marketplace-cache', 'registries');
}

function getZipCacheDir(): string {
  return path.join(app.getPath('userData'), 'marketplace-cache', 'zips');
}

function safeReadJson(filePath: string): unknown | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
  } catch {
    return undefined;
  }
}

function safeWriteJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

type PluginKvFile = { schemaVersion: 1; plugins: Record<string, Record<string, unknown>> };

function getPluginKvPath(): string {
  return path.join(app.getPath('userData'), 'plugin-kv.json');
}

function readPluginKv(): PluginKvFile {
  const raw = safeReadJson(getPluginKvPath());
  if (isRecord(raw) && raw.schemaVersion === 1 && isRecord(raw.plugins)) {
    const plugins: Record<string, Record<string, unknown>> = {};
    for (const [pid, store] of Object.entries(raw.plugins)) {
      if (!isRecord(store)) continue;
      plugins[pid] = store;
    }
    return { schemaVersion: 1, plugins };
  }
  return { schemaVersion: 1, plugins: {} };
}

function writePluginKv(data: PluginKvFile): void {
  safeWriteJson(getPluginKvPath(), data);
}

function migrateLegacyPluginStore(pluginId: string): void {
  const legacyPath = path.join(app.getPath('userData'), 'plugins', pluginId, 'store.json');
  if (!fs.existsSync(legacyPath)) return;
  const legacy = safeReadJson(legacyPath);
  if (!isRecord(legacy)) return;
  const kv = readPluginKv();
  const prev = kv.plugins[pluginId] ?? {};
  kv.plugins[pluginId] = { ...legacy, ...prev };
  writePluginKv(kv);
  try {
    fs.rmSync(legacyPath, { force: true });
  } catch {
    return;
  }
}

function readState(): MarketplaceState {
  try {
    const raw = fs.readFileSync(getStatePath(), 'utf-8');
    const parsed = JSON.parse(raw) as MarketplaceState;
    if (parsed && typeof parsed === 'object' && parsed.installed && typeof parsed.installed === 'object') return parsed;
  } catch {
    return { installed: {} };
  }
  return { installed: {} };
}

function writeState(state: MarketplaceState): void {
  fs.writeFileSync(getStatePath(), JSON.stringify(state, null, 2), 'utf-8');
}

function getInstalledRecord(id: string): InstalledPluginRecord | undefined {
  const state = readState();
  return state.installed[id];
}

function hasPermission(manifest: MarketplacePluginManifest, perm: PluginPermission): boolean {
  return Array.isArray(manifest.permissions) && manifest.permissions.includes(perm);
}

function isPrivateIp(ip: string): boolean {
  const n = ip.split('.').map((x) => Number(x));
  if (n.length !== 4 || n.some((x) => Number.isNaN(x))) return true;
  if (n[0] === 10) return true;
  if (n[0] === 127) return true;
  if (n[0] === 0) return true;
  if (n[0] === 169 && n[1] === 254) return true;
  if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return true;
  if (n[0] === 192 && n[1] === 168) return true;
  return false;
}

function isForbiddenTarget(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost') return true;
  const ipType = net.isIP(h);
  if (ipType === 4) return isPrivateIp(h);
  if (ipType === 6) return true;
  return false;
}

function resolveEntryUrl(manifest: MarketplacePluginManifest, installedAt?: string): string {
  const dir = path.join(getInstallBaseDir(), manifest.id, manifest.version);
  const entryPath = path.join(dir, manifest.entry);
  const v = typeof installedAt === 'string' && installedAt ? installedAt : manifest.version;
  return `${pathToFileURL(entryPath).toString()}?v=${encodeURIComponent(v)}`;
}

async function downloadToFile(url: string, outPath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    dbg('marketplace', 'download:start', { url });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 30000);
    const userAgent = `DevToolBox/${app.getVersion()} (${process.platform}; ${process.arch})`;
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ac.signal,
      headers: {
        'user-agent': userAgent,
        accept: 'application/octet-stream, */*',
      },
    });
    clearTimeout(timer);
    dbg('marketplace', 'download:response', { url, status: res.status });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    dbg('marketplace', 'download:saved', { outPath, size: buf.byteLength });
    return { ok: true };
  } catch (e: unknown) {
    dbg('marketplace', 'download:error', { url, error: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function sha256File(filePath: string): string {
  const h = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  h.update(data);
  return h.digest('hex');
}

function safeRemoveDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    return;
  }
}

const fileTokenMap = new Map<string, Map<string, string>>();
const pathTokenMap = new Map<string, Map<string, string>>();

type SocketProtocol = 'tcp' | 'udp';

type SocketEvent =
  | { type: 'log'; target: 'server' | 'client'; level: 'info' | 'error'; message: string }
  | {
      type: 'data';
      target: 'server' | 'client';
      data: {
        direction: 'recv' | 'sent';
        protocol: SocketProtocol;
        bytes: number;
        remote?: string;
        connId?: string;
        text?: string;
        base64?: string;
      };
    }
  | { type: 'status'; target: 'server' | 'client'; status: unknown };

type SocketConnInfo = {
  id: string;
  remote: string;
  connectedAt: string;
  recvBytes: number;
  sentBytes: number;
};

type SocketPluginState = {
  server: {
    protocol: SocketProtocol;
    host: string;
    port: number;
    tcpServer: net.Server | null;
    udpSocket: dgram.Socket | null;
    tcpClients: Map<string, { socket: net.Socket; info: SocketConnInfo }>;
    lastRemote?: string;
    totalRecvBytes: number;
    totalSentBytes: number;
  };
  client: {
    protocol: SocketProtocol;
    remoteHost: string;
    remotePort: number;
    tcpSocket: net.Socket | null;
    udpSocket: dgram.Socket | null;
    totalRecvBytes: number;
    totalSentBytes: number;
  };
};

const socketPluginStates = new Map<string, SocketPluginState>();

function getSocketState(pluginId: string): SocketPluginState {
  const hit = socketPluginStates.get(pluginId);
  if (hit) return hit;
  const created: SocketPluginState = {
    server: {
      protocol: 'tcp',
      host: '0.0.0.0',
      port: 0,
      tcpServer: null,
      udpSocket: null,
      tcpClients: new Map<string, { socket: net.Socket; info: SocketConnInfo }>(),
      lastRemote: undefined,
      totalRecvBytes: 0,
      totalSentBytes: 0,
    },
    client: {
      protocol: 'tcp',
      remoteHost: '',
      remotePort: 0,
      tcpSocket: null,
      udpSocket: null,
      totalRecvBytes: 0,
      totalSentBytes: 0,
    },
  };
  socketPluginStates.set(pluginId, created);
  return created;
}

function sendSocketEvent(pluginId: string, ev: SocketEvent): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    try {
      w.webContents.send('plugin:socketEvent', pluginId, ev);
    } catch {
      void 0;
    }
  });
}

function socketNowIso(): string {
  return new Date().toISOString();
}

function socketTruncateText(s: string, maxLen = 800): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '…';
}

function socketIsProbablyUtf8Text(s: string): boolean {
  if (!s) return true;
  if (s.includes('\uFFFD')) return false;
  let ctrl = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    const isOk = c === 9 || c === 10 || c === 13 || c >= 32;
    if (!isOk) ctrl += 1;
  }
  return ctrl <= Math.max(1, Math.floor(s.length * 0.02));
}

function socketFormatBuf(buf: Buffer): { bytes: number; text?: string; base64?: string } {
  const text = buf.toString('utf8');
  if (socketIsProbablyUtf8Text(text)) return { bytes: buf.length, text: socketTruncateText(text) };
  return { bytes: buf.length, base64: socketTruncateText(buf.toString('base64')) };
}

function socketDecodePayload(payload: string, encoding: string): Buffer {
  if (encoding === 'hex') {
    const raw = payload.trim().replace(/\s+/g, '');
    if (!raw) return Buffer.alloc(0);
    if (raw.length % 2 !== 0) throw new Error('Invalid hex payload');
    return Buffer.from(raw, 'hex');
  }
  if (encoding === 'base64') {
    const raw = payload.trim();
    if (!raw) return Buffer.alloc(0);
    return Buffer.from(raw, 'base64');
  }
  return Buffer.from(payload, 'utf8');
}

async function stopSocketServer(pluginId: string): Promise<void> {
  const st = getSocketState(pluginId);
  const s = st.server;
  for (const c of s.tcpClients.values()) {
    try {
      c.socket.destroy();
    } catch {
      void 0;
    }
  }
  s.tcpClients.clear();

  if (s.udpSocket) {
    try {
      await new Promise<void>((resolve) => s.udpSocket?.close(() => resolve()));
    } catch {
      void 0;
    }
    s.udpSocket = null;
  }

  if (s.tcpServer) {
    try {
      await new Promise<void>((resolve) => s.tcpServer?.close(() => resolve()));
    } catch {
      void 0;
    }
    s.tcpServer = null;
  }

  s.port = 0;
  s.lastRemote = undefined;
  s.totalRecvBytes = 0;
  s.totalSentBytes = 0;
  sendSocketEvent(pluginId, { type: 'status', target: 'server', status: buildSocketServerStatus(pluginId) });
}

async function stopSocketClient(pluginId: string): Promise<void> {
  const st = getSocketState(pluginId);
  const c = st.client;
  if (c.udpSocket) {
    try {
      await new Promise<void>((resolve) => c.udpSocket?.close(() => resolve()));
    } catch {
      void 0;
    }
    c.udpSocket = null;
  }
  if (c.tcpSocket) {
    try {
      c.tcpSocket.destroy();
    } catch {
      void 0;
    }
    c.tcpSocket = null;
  }
  c.remoteHost = '';
  c.remotePort = 0;
  c.totalRecvBytes = 0;
  c.totalSentBytes = 0;
  sendSocketEvent(pluginId, { type: 'status', target: 'client', status: buildSocketClientStatus(pluginId) });
}

function buildSocketServerStatus(pluginId: string): unknown {
  const st = getSocketState(pluginId);
  const s = st.server;
  return {
    running: Boolean(s.tcpServer || s.udpSocket),
    protocol: s.protocol,
    host: s.host,
    port: s.port,
    connections: Array.from(s.tcpClients.values()).map((x) => ({ id: x.info.id, remote: x.info.remote })),
    lastRemote: s.lastRemote,
    stats: { totalRecvBytes: s.totalRecvBytes, totalSentBytes: s.totalSentBytes },
  };
}

function buildSocketClientStatus(pluginId: string): unknown {
  const st = getSocketState(pluginId);
  const c = st.client;
  return {
    connected: Boolean((c.protocol === 'tcp' ? c.tcpSocket : c.udpSocket) && c.remoteHost && c.remotePort),
    protocol: c.protocol,
    remote: c.remoteHost && c.remotePort ? `${c.remoteHost}:${c.remotePort}` : '',
    stats: { totalRecvBytes: c.totalRecvBytes, totalSentBytes: c.totalSentBytes },
  };
}

async function cleanupSocketPlugin(pluginId: string): Promise<void> {
  if (!socketPluginStates.has(pluginId)) return;
  await Promise.all([stopSocketServer(pluginId), stopSocketClient(pluginId)]);
  socketPluginStates.delete(pluginId);
}

function setToken(map: Map<string, Map<string, string>>, pluginId: string, token: string, value: string): void {
  const inner = map.get(pluginId) ?? new Map<string, string>();
  inner.set(token, value);
  map.set(pluginId, inner);
}

function getToken(map: Map<string, Map<string, string>>, pluginId: string, token: string): string | undefined {
  return map.get(pluginId)?.get(token);
}

function err(code: string, message: string, details?: unknown) {
  return { ok: false, error: { code, message, details } };
}

function ok(data?: unknown) {
  return { ok: true, data };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function assertInstalledPlugin(pluginId: string): InstalledPluginRecord | undefined {
  const rec = getInstalledRecord(pluginId);
  if (!rec) return undefined;
  return rec;
}

export function register(): void {
  ipcMain.handle('marketplace:fetchRegistry', async (_event, url: string, options?: { force?: boolean }) => {
    try {
      const u = new URL(String(url ?? '').trim());
      const isDev = Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged;
      const force = Boolean(options?.force);
      if (u.protocol === 'file:') {
        if (!isDev) return { success: false, error: 'Only https is allowed' };
        const p = fileURLToPath(u);
        if (!fs.existsSync(p)) return { success: false, error: 'Registry file not found' };
        const stat = fs.statSync(p);
        if (!stat.isFile()) return { success: false, error: 'Registry path is not a file' };
        if (stat.size > 2 * 1024 * 1024) return { success: false, error: 'Registry file too large' };
        dbg('marketplace', 'registry:file:read', { path: p, size: stat.size });
        const json = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
        return { success: true, registry: json };
      }

      if (u.protocol !== 'https:') return { success: false, error: 'Only https is allowed' };
      if (isForbiddenTarget(u.hostname)) return { success: false, error: 'Forbidden target' };

      dbg('marketplace', 'registry:fetch:start', { url: u.toString() });

      const cacheKey = crypto.createHash('sha256').update(u.toString()).digest('hex');
      const cachePath = path.join(getRegistryCacheDir(), `${cacheKey}.json`);

      const cached = safeReadJson(cachePath);
      const cachedFetchedAt = isRecord(cached) && typeof cached.fetchedAt === 'number' ? cached.fetchedAt : 0;
      const cachedRegistry = isRecord(cached) ? cached.registry : undefined;
      const cachedEtag = isRecord(cached) && typeof cached.etag === 'string' ? cached.etag : undefined;
      const cachedLastModified = isRecord(cached) && typeof cached.lastModified === 'string' ? cached.lastModified : undefined;

      const ttlMs = 6 * 60 * 60 * 1000;
      if (!force && cachedRegistry && Date.now() - cachedFetchedAt < ttlMs) {
        dbg('marketplace', 'registry:cache:hit', { cachePath });
        return { success: true, registry: cachedRegistry };
      }

      const headers: Record<string, string> = {};
      if (cachedEtag) headers['if-none-match'] = cachedEtag;
      if (cachedLastModified) headers['if-modified-since'] = cachedLastModified;
      headers['user-agent'] = `DevToolBox/${app.getVersion()} (${process.platform}; ${process.arch})`;
      headers.accept = 'application/json, text/plain, */*';
      if (force) {
        headers['cache-control'] = 'no-cache';
        headers.pragma = 'no-cache';
      }

      const requestUrl = (() => {
        if (!force) return u.toString();
        const uu = new URL(u.toString());
        uu.searchParams.set('_', String(Date.now()));
        return uu.toString();
      })();

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30000);
      const res = await fetch(requestUrl, { redirect: 'follow', headers, signal: ac.signal });
      clearTimeout(timer);

      if (res.status === 304 && cachedRegistry) {
        dbg('marketplace', 'registry:not-modified', { url: u.toString() });
        safeWriteJson(cachePath, {
          url: u.toString(),
          fetchedAt: Date.now(),
          etag: cachedEtag,
          lastModified: cachedLastModified,
          registry: cachedRegistry,
        });
        return { success: true, registry: cachedRegistry };
      }

      if (!res.ok) {
        let details = '';
        try {
          details = (await res.text()).slice(0, 300);
        } catch {
          details = '';
        }
        dbg('marketplace', 'registry:fetch:failed', { url: u.toString(), status: res.status, details });
        if (cachedRegistry) return { success: true, registry: cachedRegistry };
        return { success: false, error: `HTTP ${res.status}${details ? `: ${details}` : ''}` };
      }

      const json = (await res.json()) as unknown;
      safeWriteJson(cachePath, {
        url: u.toString(),
        fetchedAt: Date.now(),
        etag: res.headers.get('etag') ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
        registry: json,
      });

      dbg('marketplace', 'registry:fetch:ok', { url: u.toString(), cachePath });
      return { success: true, registry: json };
    } catch (e: unknown) {
      dbg('marketplace', 'registry:fetch:error', { url: String(url ?? ''), error: e instanceof Error ? e.message : String(e) });
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('marketplace:listInstalled', () => {
    const state = readState();
    return Object.values(state.installed).map((p) => ({
      id: p.id,
      version: p.version,
      enabled: p.enabled,
      installedAt: p.installedAt,
      entryUrl: resolveEntryUrl(p.manifest, p.installedAt),
      manifest: p.manifest,
    }));
  });

  ipcMain.handle('marketplace:setEnabled', async (_event, id: string, enabled: boolean) => {
    try {
      const state = readState();
      const rec = state.installed[id];
      if (!rec) return { success: false, error: 'Plugin not installed' };
      rec.enabled = Boolean(enabled);
      state.installed[id] = rec;
      writeState(state);
      if (!rec.enabled) await cleanupSocketPlugin(rec.id);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('marketplace:uninstall', async (_event, id: string) => {
    try {
      const state = readState();
      const rec = state.installed[id];
      if (!rec) return { success: false, error: 'Plugin not installed' };
      await cleanupSocketPlugin(rec.id);
      fileTokenMap.delete(rec.id);
      pathTokenMap.delete(rec.id);

      const pluginDir = path.join(getInstallBaseDir(), rec.id);
      safeRemoveDir(pluginDir);

      const pluginDataDir = path.join(app.getPath('userData'), 'plugins', rec.id);
      safeRemoveDir(pluginDataDir);

      delete state.installed[id];
      writeState(state);
      return { success: true };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('marketplace:install', async (_event, entry: MarketplaceRegistryEntry) => {
    try {
      if (!entry?.manifest?.id || !entry?.manifest?.version) return { success: false, error: 'Invalid entry' };
      const registryManifest = entry.manifest;
      const expectedSha = String(entry.sha256 ?? '').trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(expectedSha)) return { success: false, error: 'Invalid sha256' };
      dbg('marketplace', 'install:start', { id: registryManifest.id, version: registryManifest.version, sha256: expectedSha });
      const isDev = Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged;
      let download: URL;
      try {
        download = new URL(String(entry.downloadUrl ?? '').trim());
      } catch {
        dbg('marketplace', 'install:failed', { reason: 'downloadUrl_invalid', downloadUrl: String(entry.downloadUrl ?? '') });
        return { success: false, error: 'Invalid downloadUrl' };
      }
      const baseDir = getInstallBaseDir();
      fs.mkdirSync(baseDir, { recursive: true });

      const zipCacheDir = getZipCacheDir();
      fs.mkdirSync(zipCacheDir, { recursive: true });
      const cachedZipPath = path.join(zipCacheDir, `${expectedSha}.zip`);
      const zipPath = cachedZipPath;

      if (download.protocol === 'file:') {
        if (!isDev) return { success: false, error: 'Only https downloadUrl is allowed' };
        const srcPath = fileURLToPath(download);
        if (!fs.existsSync(srcPath)) {
          dbg('marketplace', 'install:failed', { reason: 'file_not_found', srcPath });
          return { success: false, error: 'Zip file not found' };
        }
        const stat = fs.statSync(srcPath);
        if (!stat.isFile()) {
          dbg('marketplace', 'install:failed', { reason: 'file_not_a_file', srcPath });
          return { success: false, error: 'Zip path is not a file' };
        }
        if (!fs.existsSync(cachedZipPath)) {
          const hash = sha256File(srcPath).toLowerCase();
          if (hash !== expectedSha) {
            dbg('marketplace', 'install:zip:sha-mismatch', { expectedSha, actualSha: hash });
            return { success: false, error: 'SHA256 mismatch' };
          }
          fs.copyFileSync(srcPath, cachedZipPath);
          dbg('marketplace', 'install:zip:cached', { cachedZipPath });
        } else {
          dbg('marketplace', 'install:zip:cache-hit', { cachedZipPath });
        }
      } else {
        if (download.protocol !== 'https:') {
          dbg('marketplace', 'install:failed', { reason: 'download_protocol', protocol: download.protocol });
          return { success: false, error: 'Only https downloadUrl is allowed' };
        }
        if (download.hostname === 'example.invalid') {
          dbg('marketplace', 'install:failed', { reason: 'placeholder_downloadUrl' });
          return { success: false, error: 'Registry is using placeholder downloadUrl.' };
        }
        if (isForbiddenTarget(download.hostname)) {
          dbg('marketplace', 'install:failed', { reason: 'forbidden_download_host', hostname: download.hostname });
          return { success: false, error: 'Forbidden download host' };
        }

        if (!fs.existsSync(cachedZipPath)) {
          dbg('marketplace', 'install:zip:cache-miss', { cachedZipPath, downloadUrl: download.toString() });
          const tmpFile = path.join(app.getPath('temp'), `devtoolbox_${registryManifest.id}_${Date.now()}.zip`);
          const dl = await downloadToFile(download.toString(), tmpFile);
          if (!dl.ok) return { success: false, error: dl.error ?? 'Download failed' };

          const hash = sha256File(tmpFile).toLowerCase();
          if (hash !== expectedSha) {
            safeRemoveDir(tmpFile);
            dbg('marketplace', 'install:zip:sha-mismatch', { expectedSha, actualSha: hash });
            return { success: false, error: 'SHA256 mismatch' };
          }

          try {
            fs.renameSync(tmpFile, cachedZipPath);
          } catch {
            try {
              fs.copyFileSync(tmpFile, cachedZipPath);
            } finally {
              safeRemoveDir(tmpFile);
            }
          }
          dbg('marketplace', 'install:zip:cached', { cachedZipPath });
        } else {
          dbg('marketplace', 'install:zip:cache-hit', { cachedZipPath });
        }
      }

      const targetDir = path.join(baseDir, registryManifest.id, registryManifest.version);
      safeRemoveDir(targetDir);
      fs.mkdirSync(targetDir, { recursive: true });
      dbg('marketplace', 'install:extract', { zipPath, targetDir });
      await extract(zipPath, { dir: targetDir });

      const manifestPath = path.join(targetDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        safeRemoveDir(targetDir);
        dbg('marketplace', 'install:failed', { reason: 'manifest_missing' });
        return { success: false, error: 'manifest.json not found in package' };
      }
      const packageManifestRaw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as unknown;
      const parsed = validateManifest(packageManifestRaw);
      if (!parsed.ok) {
        safeRemoveDir(targetDir);
        dbg('marketplace', 'install:failed', { reason: 'manifest_invalid', error: parsed.error });
        return { success: false, error: `Invalid manifest.json: ${parsed.error}` };
      }

      const diff = compareManifests(registryManifest, parsed.data);
      if (diff.length) {
        safeRemoveDir(targetDir);
        dbg('marketplace', 'install:failed', { reason: 'manifest_mismatch', diff });
        return { success: false, error: `manifest mismatch: ${diff.join(', ')}` };
      }

      const entryPath = path.join(targetDir, registryManifest.entry);
      const resolvedEntryPath = path.resolve(entryPath);
      if (!resolvedEntryPath.startsWith(path.resolve(targetDir) + path.sep)) {
        safeRemoveDir(targetDir);
        dbg('marketplace', 'install:failed', { reason: 'entry_path_invalid' });
        return { success: false, error: 'Invalid entry path' };
      }
      if (!fs.existsSync(resolvedEntryPath)) {
        safeRemoveDir(targetDir);
        dbg('marketplace', 'install:failed', { reason: 'entry_missing', entry: registryManifest.entry });
        return { success: false, error: `Entry not found: ${registryManifest.entry}` };
      }

      const state = readState();
      const prev = state.installed[registryManifest.id];
      const prevEnabled = prev ? Boolean(prev.enabled) : true;
      const prevVersion = prev?.version ? String(prev.version) : '';
      if (prevVersion && prevVersion !== registryManifest.version) {
        const oldDir = path.join(baseDir, registryManifest.id, prevVersion);
        safeRemoveDir(oldDir);
      }
      state.installed[registryManifest.id] = {
        id: registryManifest.id,
        version: registryManifest.version,
        enabled: prevEnabled,
        installedAt: new Date().toISOString(),
        manifest: parsed.data,
      };
      writeState(state);
      dbg('marketplace', 'install:ok', { id: registryManifest.id, version: registryManifest.version });
      return { success: true };
    } catch (e: unknown) {
      dbg('marketplace', 'install:error', { error: e instanceof Error ? e.message : String(e) });
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('plugin:log', (_event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    const p = isRecord(params) ? params : {};
    const level = asString(p.level, 'log');
    const message = asString(p.message, typeof params === 'string' ? params : '');
    const data = (p as Record<string, unknown>).data;
    const prefix = `[plugin:${pluginId}]`;

    const msg = message.length > 2000 ? `${message.slice(0, 2000)}…` : message;
    const args = data === undefined ? [`${prefix} ${msg}`] : [`${prefix} ${msg}`, data];

    if (level === 'debug' && !isDebugEnabled()) return ok(true);
    if (level === 'debug') console.debug(...args);
    else if (level === 'info') console.info(...args);
    else if (level === 'warn') console.warn(...args);
    else if (level === 'error') console.error(...args);
    else console.log(...args);

    return ok(true);
  });

  ipcMain.handle('plugin:socketServerStart', async (_event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'net:socket')) return err('permission_denied', 'Missing permission: net:socket');
    try {
      const p = isRecord(params) ? params : {};
      const protocol: SocketProtocol = asString(p.protocol, 'tcp') === 'udp' ? 'udp' : 'tcp';
      const host = asString(p.host, '0.0.0.0').trim() || '0.0.0.0';
      const port = Math.floor(Number((p as Record<string, unknown>).port ?? 0));
      if (!port || port < 1 || port > 65535) return err('invalid_params', 'Invalid port');

      await stopSocketServer(pluginId);

      const st = getSocketState(pluginId);
      st.server.protocol = protocol;
      st.server.host = host;
      st.server.port = port;
      st.server.lastRemote = undefined;
      st.server.totalRecvBytes = 0;
      st.server.totalSentBytes = 0;

      sendSocketEvent(pluginId, { type: 'log', target: 'server', level: 'info', message: `${protocol} server start ${host}:${port}` });

      if (protocol === 'tcp') {
        const srv = net.createServer();
        st.server.tcpServer = srv;

        srv.on('connection', (socket) => {
          const id = crypto.randomBytes(8).toString('hex');
          const remote = `${socket.remoteAddress ?? '-'}:${socket.remotePort ?? ''}`;
          const info: SocketConnInfo = { id, remote, connectedAt: socketNowIso(), recvBytes: 0, sentBytes: 0 };
          st.server.tcpClients.set(id, { socket, info });
          sendSocketEvent(pluginId, { type: 'log', target: 'server', level: 'info', message: `tcp client connected ${remote} (${id})` });
          sendSocketEvent(pluginId, { type: 'status', target: 'server', status: buildSocketServerStatus(pluginId) });

          socket.on('data', (buf) => {
            info.recvBytes += buf.length;
            st.server.totalRecvBytes += buf.length;
            const fmt = socketFormatBuf(buf);
            sendSocketEvent(pluginId, {
              type: 'data',
              target: 'server',
              data: { direction: 'recv', protocol: 'tcp', remote, connId: id, ...fmt },
            });
            sendSocketEvent(pluginId, { type: 'status', target: 'server', status: buildSocketServerStatus(pluginId) });
          });
          socket.on('close', () => {
            st.server.tcpClients.delete(id);
            sendSocketEvent(pluginId, { type: 'log', target: 'server', level: 'info', message: `tcp client closed ${remote} (${id})` });
            sendSocketEvent(pluginId, { type: 'status', target: 'server', status: buildSocketServerStatus(pluginId) });
          });
          socket.on('error', (e) => {
            sendSocketEvent(pluginId, {
              type: 'log',
              target: 'server',
              level: 'error',
              message: `tcp client error ${remote} (${id}) ${e instanceof Error ? e.message : String(e)}`,
            });
          });
        });

        await new Promise<void>((resolve, reject) => {
          srv.listen(port, host, () => resolve());
          srv.once('error', reject);
        });

        const status = buildSocketServerStatus(pluginId);
        sendSocketEvent(pluginId, { type: 'status', target: 'server', status });
        return ok(status);
      }

      const sock = dgram.createSocket('udp4');
      st.server.udpSocket = sock;
      sock.on('error', (e) => {
        sendSocketEvent(pluginId, {
          type: 'log',
          target: 'server',
          level: 'error',
          message: `udp server error ${e instanceof Error ? e.message : String(e)}`,
        });
      });
      sock.on('message', (msg, rinfo) => {
        const remote = `${rinfo.address}:${rinfo.port}`;
        st.server.lastRemote = remote;
        st.server.totalRecvBytes += msg.length;
        const fmt = socketFormatBuf(msg);
        sendSocketEvent(pluginId, { type: 'data', target: 'server', data: { direction: 'recv', protocol: 'udp', remote, ...fmt } });
        sendSocketEvent(pluginId, { type: 'status', target: 'server', status: buildSocketServerStatus(pluginId) });
      });

      await new Promise<void>((resolve, reject) => {
        sock.bind(port, host, () => resolve());
        sock.once('error', reject);
      });

      const status = buildSocketServerStatus(pluginId);
      sendSocketEvent(pluginId, { type: 'status', target: 'server', status });
      return ok(status);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:socketServerStop', async (_event, pluginId: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'net:socket')) return err('permission_denied', 'Missing permission: net:socket');
    try {
      await stopSocketServer(pluginId);
      return ok(buildSocketServerStatus(pluginId));
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:socketServerStatus', (_event, pluginId: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'net:socket')) return err('permission_denied', 'Missing permission: net:socket');
    try {
      return ok(buildSocketServerStatus(pluginId));
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:socketServerKick', (_event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'net:socket')) return err('permission_denied', 'Missing permission: net:socket');
    try {
      const st = getSocketState(pluginId);
      const p = isRecord(params) ? params : {};
      const connId = asString(p.connId).trim();
      const hit = connId ? st.server.tcpClients.get(connId) : null;
      if (hit) {
        try {
          hit.socket.destroy();
        } catch {
          void 0;
        }
        st.server.tcpClients.delete(connId);
      }
      const status = buildSocketServerStatus(pluginId);
      sendSocketEvent(pluginId, { type: 'status', target: 'server', status });
      return ok(status);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:socketServerSend', async (_event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'net:socket')) return err('permission_denied', 'Missing permission: net:socket');
    try {
      const st = getSocketState(pluginId);
      const p = isRecord(params) ? params : {};
      const protocol: SocketProtocol = asString(p.protocol, st.server.protocol) === 'udp' ? 'udp' : 'tcp';
      const encoding = asString(p.encoding, 'utf8');
      const payload = asString(p.payload, '');
      const buf = socketDecodePayload(payload, encoding);

      if (protocol === 'tcp') {
        const connId = asString(p.connId).trim();
        const targets = connId
          ? st.server.tcpClients.get(connId)
            ? [st.server.tcpClients.get(connId)!]
            : []
          : Array.from(st.server.tcpClients.values());
        for (const t of targets) {
          try {
            t.socket.write(buf);
            t.info.sentBytes += buf.length;
            st.server.totalSentBytes += buf.length;
            const fmt = socketFormatBuf(buf);
            sendSocketEvent(pluginId, {
              type: 'data',
              target: 'server',
              data: { direction: 'sent', protocol: 'tcp', remote: t.info.remote, connId: t.info.id, ...fmt },
            });
          } catch (e) {
            sendSocketEvent(pluginId, {
              type: 'log',
              target: 'server',
              level: 'error',
              message: `tcp send error ${t.info.remote} (${t.info.id}) ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }
        const status = buildSocketServerStatus(pluginId);
        sendSocketEvent(pluginId, { type: 'status', target: 'server', status });
        return ok(true);
      }

      const remote = asString(p.remote, st.server.lastRemote ?? '').trim();
      const [rh, rp] = remote.includes(':') ? remote.split(':', 2) : [remote, ''];
      const rport = Math.floor(Number(rp));
      if (!st.server.udpSocket) return err('invalid_state', 'UDP server not running');
      if (!rh || !rport || rport < 1 || rport > 65535) return err('invalid_params', 'Invalid remote');
      await new Promise<void>((resolve, reject) => {
        st.server.udpSocket?.send(buf, rport, rh, (e) => {
          if (e) reject(e);
          else resolve();
        });
      });
      st.server.totalSentBytes += buf.length;
      const fmt = socketFormatBuf(buf);
      sendSocketEvent(pluginId, { type: 'data', target: 'server', data: { direction: 'sent', protocol: 'udp', remote: `${rh}:${rport}`, ...fmt } });
      const status = buildSocketServerStatus(pluginId);
      sendSocketEvent(pluginId, { type: 'status', target: 'server', status });
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:socketClientConnect', async (_event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'net:socket')) return err('permission_denied', 'Missing permission: net:socket');
    try {
      const p = isRecord(params) ? params : {};
      const protocol: SocketProtocol = asString(p.protocol, 'tcp') === 'udp' ? 'udp' : 'tcp';
      const host = asString(p.host, '').trim();
      const port = Math.floor(Number((p as Record<string, unknown>).port ?? 0));
      if (!host) return err('invalid_params', 'Invalid host');
      if (!port || port < 1 || port > 65535) return err('invalid_params', 'Invalid port');

      await stopSocketClient(pluginId);

      const st = getSocketState(pluginId);
      st.client.protocol = protocol;
      st.client.remoteHost = host;
      st.client.remotePort = port;
      st.client.totalRecvBytes = 0;
      st.client.totalSentBytes = 0;

      sendSocketEvent(pluginId, { type: 'log', target: 'client', level: 'info', message: `${protocol} client connect ${host}:${port}` });

      if (protocol === 'tcp') {
        const sock = new net.Socket();
        st.client.tcpSocket = sock;
        sock.on('data', (buf) => {
          st.client.totalRecvBytes += buf.length;
          const fmt = socketFormatBuf(buf);
          sendSocketEvent(pluginId, { type: 'data', target: 'client', data: { direction: 'recv', protocol: 'tcp', remote: `${host}:${port}`, ...fmt } });
          sendSocketEvent(pluginId, { type: 'status', target: 'client', status: buildSocketClientStatus(pluginId) });
        });
        sock.on('close', () => {
          sendSocketEvent(pluginId, { type: 'log', target: 'client', level: 'info', message: `tcp client closed` });
          void stopSocketClient(pluginId);
        });
        sock.on('error', (e) => {
          sendSocketEvent(pluginId, { type: 'log', target: 'client', level: 'error', message: `tcp client error ${e instanceof Error ? e.message : String(e)}` });
        });

        await new Promise<void>((resolve, reject) => {
          sock.connect(port, host, () => resolve());
          sock.once('error', reject);
        });
        const status = buildSocketClientStatus(pluginId);
        sendSocketEvent(pluginId, { type: 'status', target: 'client', status });
        return ok(status);
      }

      const sock = dgram.createSocket('udp4');
      st.client.udpSocket = sock;
      sock.on('error', (e) => {
        sendSocketEvent(pluginId, { type: 'log', target: 'client', level: 'error', message: `udp client error ${e instanceof Error ? e.message : String(e)}` });
      });
      sock.on('message', (msg, rinfo) => {
        st.client.totalRecvBytes += msg.length;
        const fmt = socketFormatBuf(msg);
        sendSocketEvent(pluginId, { type: 'data', target: 'client', data: { direction: 'recv', protocol: 'udp', remote: `${rinfo.address}:${rinfo.port}`, ...fmt } });
        sendSocketEvent(pluginId, { type: 'status', target: 'client', status: buildSocketClientStatus(pluginId) });
      });
      await new Promise<void>((resolve, reject) => {
        sock.bind(0, () => resolve());
        sock.once('error', reject);
      });

      const status = buildSocketClientStatus(pluginId);
      sendSocketEvent(pluginId, { type: 'status', target: 'client', status });
      return ok(status);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:socketClientDisconnect', async (_event, pluginId: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'net:socket')) return err('permission_denied', 'Missing permission: net:socket');
    try {
      await stopSocketClient(pluginId);
      return ok(buildSocketClientStatus(pluginId));
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:socketClientStatus', (_event, pluginId: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'net:socket')) return err('permission_denied', 'Missing permission: net:socket');
    try {
      return ok(buildSocketClientStatus(pluginId));
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:socketClientSend', async (_event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'net:socket')) return err('permission_denied', 'Missing permission: net:socket');
    try {
      const st = getSocketState(pluginId);
      const p = isRecord(params) ? params : {};
      const protocol: SocketProtocol = asString(p.protocol, st.client.protocol) === 'udp' ? 'udp' : 'tcp';
      const encoding = asString(p.encoding, 'utf8');
      const payload = asString(p.payload, '');
      const buf = socketDecodePayload(payload, encoding);
      if (!st.client.remoteHost || !st.client.remotePort) return err('invalid_state', 'Client not connected');

      if (protocol === 'tcp') {
        if (!st.client.tcpSocket) return err('invalid_state', 'TCP client not connected');
        st.client.tcpSocket.write(buf);
        st.client.totalSentBytes += buf.length;
        const fmt = socketFormatBuf(buf);
        sendSocketEvent(pluginId, { type: 'data', target: 'client', data: { direction: 'sent', protocol: 'tcp', remote: `${st.client.remoteHost}:${st.client.remotePort}`, ...fmt } });
        sendSocketEvent(pluginId, { type: 'status', target: 'client', status: buildSocketClientStatus(pluginId) });
        return ok(true);
      }

      if (!st.client.udpSocket) return err('invalid_state', 'UDP client not ready');
      await new Promise<void>((resolve, reject) => {
        st.client.udpSocket?.send(buf, st.client.remotePort, st.client.remoteHost, (e) => {
          if (e) reject(e);
          else resolve();
        });
      });
      st.client.totalSentBytes += buf.length;
      const fmt = socketFormatBuf(buf);
      sendSocketEvent(pluginId, { type: 'data', target: 'client', data: { direction: 'sent', protocol: 'udp', remote: `${st.client.remoteHost}:${st.client.remotePort}`, ...fmt } });
      sendSocketEvent(pluginId, { type: 'status', target: 'client', status: buildSocketClientStatus(pluginId) });
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:httpRequest', async (_event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'http:proxy')) return err('permission_denied', 'Missing permission: http:proxy');
    const p = isRecord(params) ? params : {};
    const url = typeof p.url === 'string' ? p.url : '';
    const method = typeof p.method === 'string' ? p.method.toUpperCase() : 'GET';
    const timeoutMs = typeof p.timeoutMs === 'number' ? Math.max(0, Math.min(30000, p.timeoutMs)) : 15000;
    const responseType = typeof p.responseType === 'string' ? p.responseType : 'text';

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return err('invalid_params', 'Invalid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return err('invalid_params', 'Unsupported protocol');
    if (isForbiddenTarget(parsed.hostname)) return err('network_blocked', 'Forbidden target');

    const headers =
      isRecord(p.headers) && Object.keys(p.headers).length
        ? Object.fromEntries(
            Object.entries(p.headers)
              .filter(([, v]) => typeof v === 'string')
              .map(([k, v]) => [k, v as string]),
          )
        : undefined;
    const body = typeof p.body === 'string' ? p.body : undefined;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(parsed.toString(), { method, headers, body, signal: ac.signal });
      const maxBytes = 10 * 1024 * 1024;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > maxBytes) return err('too_large', 'Response too large');

      const outHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        outHeaders[k] = v;
      });

      if (responseType === 'json') {
        try {
          return ok({ status: res.status, headers: outHeaders, data: JSON.parse(buf.toString('utf-8')) });
        } catch {
          return err('io_error', 'Failed to parse JSON');
        }
      }
      if (responseType === 'arrayBuffer') {
        return ok({ status: res.status, headers: outHeaders, data: buf.toString('base64') });
      }
      return ok({ status: res.status, headers: outHeaders, data: buf.toString('utf-8') });
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  });

  ipcMain.handle('plugin:storageGet', (_event, pluginId: string, key: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'storage:kv')) return err('permission_denied', 'Missing permission: storage:kv');
    try {
      migrateLegacyPluginStore(pluginId);
      const kv = readPluginKv();
      const store = kv.plugins[pluginId] ?? {};
      return ok(store?.[key] ?? null);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:storageSet', (_event, pluginId: string, key: string, value: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'storage:kv')) return err('permission_denied', 'Missing permission: storage:kv');
    try {
      migrateLegacyPluginStore(pluginId);
      const kv = readPluginKv();
      const store = kv.plugins[pluginId] ?? {};
      store[key] = value;
      kv.plugins[pluginId] = store;
      writePluginKv(kv);
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:storageDelete', (_event, pluginId: string, key: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'storage:kv')) return err('permission_denied', 'Missing permission: storage:kv');
    try {
      migrateLegacyPluginStore(pluginId);
      const kv = readPluginKv();
      const store = kv.plugins[pluginId] ?? {};
      delete store[key];
      kv.plugins[pluginId] = store;
      writePluginKv(kv);
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:storageList', (_event, pluginId: string, prefix?: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'storage:kv')) return err('permission_denied', 'Missing permission: storage:kv');
    try {
      migrateLegacyPluginStore(pluginId);
      const kv = readPluginKv();
      const store = kv.plugins[pluginId] ?? {};
      const keys = Object.keys(store ?? {});
      const filtered = typeof prefix === 'string' && prefix ? keys.filter((k) => k.startsWith(prefix)) : keys;
      return ok(filtered);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:storageClear', (_event, pluginId: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'storage:kv')) return err('permission_denied', 'Missing permission: storage:kv');
    try {
      migrateLegacyPluginStore(pluginId);
      const kv = readPluginKv();
      delete kv.plugins[pluginId];
      writePluginKv(kv);
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:fsOpenFileDialog', async (event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'fs:dialog')) return err('permission_denied', 'Missing permission: fs:dialog');
    const p = isRecord(params) ? params : {};
    const filters =
      Array.isArray(p.filters) && p.filters.every((f) => isRecord(f) && typeof f.name === 'string' && Array.isArray(f.extensions))
        ? (p.filters as FileFilter[])
        : undefined;
    const multiple = Boolean(p.multiple);
    const win = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: 'Open File',
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
      properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths.length) return ok({ items: [] });
    const items = result.filePaths.map((fp) => {
      const fileToken = crypto.randomUUID();
      setToken(fileTokenMap, pluginId, fileToken, fp);
      return { fileToken, name: path.basename(fp) };
    });
    return ok({ items });
  });

  ipcMain.handle('plugin:fsSaveFileDialog', async (event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'fs:dialog')) return err('permission_denied', 'Missing permission: fs:dialog');
    const p = isRecord(params) ? params : {};
    const suggestedName = typeof p.suggestedName === 'string' ? p.suggestedName : 'output.txt';
    const filters =
      Array.isArray(p.filters) && p.filters.every((f) => isRecord(f) && typeof f.name === 'string' && Array.isArray(f.extensions))
        ? (p.filters as FileFilter[])
        : undefined;
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: 'Save File',
      defaultPath: suggestedName,
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return ok(null);
    const fileToken = crypto.randomUUID();
    setToken(fileTokenMap, pluginId, fileToken, result.filePath);
    return ok({ fileToken, name: path.basename(result.filePath) });
  });

  ipcMain.handle('plugin:fsReadFile', (_event, pluginId: string, fileToken: string, encoding?: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'fs:read')) return err('permission_denied', 'Missing permission: fs:read');
    const fp = getToken(fileTokenMap, pluginId, fileToken);
    if (!fp) return err('invalid_params', 'Invalid fileToken');
    try {
      const enc = typeof encoding === 'string' ? encoding : 'utf-8';
      const content = fs.readFileSync(fp, enc as BufferEncoding);
      return ok({ content });
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:fsWriteFile', (_event, pluginId: string, fileToken: string, content: string, encoding?: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'fs:write')) return err('permission_denied', 'Missing permission: fs:write');
    const fp = getToken(fileTokenMap, pluginId, fileToken);
    if (!fp) return err('invalid_params', 'Invalid fileToken');
    try {
      const enc = typeof encoding === 'string' ? encoding : 'utf-8';
      fs.writeFileSync(fp, content, enc as BufferEncoding);
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:systemOpenExternal', async (_event, pluginId: string, url: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'system:openExternal'))
      return err('permission_denied', 'Missing permission: system:openExternal');
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return err('invalid_params', 'Unsupported URL');
      await shell.openExternal(parsed.toString());
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:systemRevealPath', (_event, pluginId: string, pathToken: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'system:revealPath'))
      return err('permission_denied', 'Missing permission: system:revealPath');
    const fp = getToken(pathTokenMap, pluginId, pathToken) ?? getToken(fileTokenMap, pluginId, pathToken);
    if (!fp) return err('invalid_params', 'Invalid pathToken');
    try {
      shell.showItemInFolder(fp);
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:systemOpenPath', async (_event, pluginId: string, pathToken: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'system:openPath'))
      return err('permission_denied', 'Missing permission: system:openPath');
    const fp = getToken(pathTokenMap, pluginId, pathToken) ?? getToken(fileTokenMap, pluginId, pathToken);
    if (!fp) return err('invalid_params', 'Invalid pathToken');
    try {
      await shell.openPath(fp);
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:systemNotify', (_event, pluginId: string, params: unknown) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'system:notifications'))
      return err('permission_denied', 'Missing permission: system:notifications');
    const p = isRecord(params) ? params : {};
    const title = typeof p.title === 'string' ? p.title : 'DevToolBox';
    const body = typeof p.body === 'string' ? p.body : '';
    try {
      if (!Notification.isSupported()) return err('not_supported', 'Notifications not supported');
      new Notification({ title, body }).show();
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('plugin:systemGetInfo', (_event, pluginId: string) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'system:getInfo'))
      return err('permission_denied', 'Missing permission: system:getInfo');
    return ok({
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      hostname: os.hostname(),
      node: process.versions.node,
      electron: process.versions.electron,
    });
  });

  ipcMain.handle('plugin:systemGetEnv', (_event, pluginId: string, keys: string[]) => {
    const rec = assertInstalledPlugin(pluginId);
    if (!rec) return err('not_installed', 'Plugin not installed');
    if (!hasPermission(rec.manifest, 'system:env:read'))
      return err('permission_denied', 'Missing permission: system:env:read');
    const allow = new Set(rec.manifest.envAllowlist ?? []);
    const out: Record<string, string | undefined> = {};
    for (const k of Array.isArray(keys) ? keys : []) {
      if (typeof k !== 'string') continue;
      if (!allow.has(k)) continue;
      out[k] = process.env[k];
    }
    return ok(out);
  });
}
