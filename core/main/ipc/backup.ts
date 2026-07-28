import { app, ipcMain, dialog } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import {
  readMarketplaceState,
  readPluginKv,
  writeMarketplaceState,
  writePluginKv,
  type PluginKvFile,
} from '../storage/plugin-data';
import { backupProtectionModes } from '../backup/protection';
import type { BackupExportOptions, BackupImportParams } from '@devtoolbox/core';
import { validateBackupExportOptions, validateBackupImportParams } from './validation';

type BackupPayloadV1 = {
  localStorage?: Record<string, string>;
  pluginStores?: Record<string, unknown>;
  marketplaceState?: unknown;
};

type BackupPayloadV2 = {
  localStorage?: Record<string, string>;
  pluginKv?: PluginKvFile;
  marketplaceState?: unknown;
};

type BackupFileV1 =
  | {
      schemaVersion: 1;
      createdAt: string;
      app: { name: string; version: string };
      encryption: { mode: 'none' };
      payload: BackupPayloadV1;
    }
  | {
      schemaVersion: 1;
      createdAt: string;
      app: { name: string; version: string };
      encryption: {
        mode: 'device' | 'password' | 'device+password';
        alg: 'aes-256-gcm';
        kdf: 'scrypt';
        salt: string;
        iv: string;
        tag: string;
      };
      payload: { ciphertext: string };
    };

type BackupLayer = {
  mode: 'builtin' | 'device' | 'password';
  alg: 'aes-256-gcm';
  kdf: 'scrypt';
  salt: string;
  iv: string;
  tag: string;
};

type BackupFileV2 = {
  schemaVersion: 2;
  createdAt: string;
  app: { name: string; version: string };
  encryption: { layers: BackupLayer[] };
  payload: { ciphertext: string };
};

type AnyBuffer = Buffer<ArrayBufferLike>;
type FileSnapshot =
  | { exists: false }
  | { exists: true; kind: 'file'; content: Buffer }
  | { exists: true; kind: 'other' };

const DTBX_MAGIC = Buffer.from('DTBX', 'ascii');
const DTBX_VERSION = 3;
const scrypt = promisify(crypto.scrypt);
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function modeToByte(mode: BackupLayer['mode']): number {
  if (mode === 'builtin') return 0;
  if (mode === 'device') return 1;
  return 2;
}

function byteToMode(b: number): BackupLayer['mode'] | null {
  if (b === 0) return 'builtin';
  if (b === 1) return 'device';
  if (b === 2) return 'password';
  return null;
}

function writeU32BE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function readU32BE(buf: Buffer, offset: number): number | null {
  if (offset + 4 > buf.length) return null;
  return buf.readUInt32BE(offset);
}

function encodeBackupBinary(layers: BackupLayer[], ciphertext: AnyBuffer): Buffer {
  const out: Buffer[] = [];
  out.push(DTBX_MAGIC);
  out.push(Buffer.from([DTBX_VERSION, layers.length & 0xff]));
  for (const layer of layers) {
    const salt = Buffer.from(layer.salt, 'base64');
    const iv = Buffer.from(layer.iv, 'base64');
    const tag = Buffer.from(layer.tag, 'base64');
    if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) {
      throw new Error('invalid_layer');
    }
    out.push(Buffer.from([modeToByte(layer.mode)]));
    out.push(salt, iv, tag);
  }
  out.push(writeU32BE(ciphertext.length));
  out.push(ciphertext);
  return Buffer.concat(out);
}

function decodeBackupBinary(buf: Buffer): { layers: BackupLayer[]; ciphertext: AnyBuffer } | null {
  if (buf.length < 6) return null;
  if (!buf.subarray(0, 4).equals(DTBX_MAGIC)) return null;
  const version = buf[4];
  if (version !== DTBX_VERSION) return null;
  const layerCount = buf[5];
  let o = 6;
  const layers: BackupLayer[] = [];
  for (let i = 0; i < layerCount; i += 1) {
    if (o + 1 + 16 + 12 + 16 > buf.length) return null;
    const mode = byteToMode(buf[o]);
    if (!mode) return null;
    const salt = buf.subarray(o + 1, o + 1 + 16);
    const iv = buf.subarray(o + 1 + 16, o + 1 + 16 + 12);
    const tag = buf.subarray(o + 1 + 16 + 12, o + 1 + 16 + 12 + 16);
    layers.push({
      mode,
      alg: 'aes-256-gcm',
      kdf: 'scrypt',
      salt: Buffer.from(salt).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      tag: Buffer.from(tag).toString('base64'),
    });
    o += 1 + 16 + 12 + 16;
  }
  const len = readU32BE(buf, o);
  if (len == null) return null;
  o += 4;
  if (o + len > buf.length) return null;
  const ciphertext = buf.subarray(o, o + len);
  return { layers, ciphertext: Buffer.from(ciphertext) };
}

function getDeviceId(): string {
  const p = path.join(app.getPath('userData'), 'device-id.txt');
  try {
    if (fs.existsSync(p)) return String(fs.readFileSync(p, 'utf-8')).trim();
    const id = crypto.randomUUID();
    fs.writeFileSync(p, id, 'utf-8');
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const DEV_BUILTIN_KEY = (() => {
  const m = 73;
  const a = [36, 24, 127, 51, 123, 30, 34, 112, 25, 122, 40, 1, 126, 49, 7, 120];
  return String.fromCharCode(...a.map((n) => n ^ m));
})();

function getBuiltinBackupKey(): string {
  try {
    const p = path.join(process.resourcesPath, 'key.txt');
    if (!fs.existsSync(p)) return DEV_BUILTIN_KEY;
    const v = String(fs.readFileSync(p, 'utf-8')).trim();
    return v ? v : DEV_BUILTIN_KEY;
  } catch {
    return DEV_BUILTIN_KEY;
  }
}

function getBuiltinBackupMaterial(): string {
  return `devtoolbox:backup:builtin:v2:${getBuiltinBackupKey()}`;
}

async function deriveKey(material: string, salt: Buffer): Promise<Buffer> {
  return (await scrypt(material, salt, 32)) as Buffer;
}

async function encryptBytes(
  material: string,
  plaintext: AnyBuffer,
): Promise<{ layer: BackupLayer; ciphertext: AnyBuffer }> {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = await deriveKey(material, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    layer: {
      mode: 'builtin',
      alg: 'aes-256-gcm',
      kdf: 'scrypt',
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    },
    ciphertext: ciphertext,
  };
}

async function decryptBytes(material: string, layer: BackupLayer, ciphertext: AnyBuffer): Promise<AnyBuffer> {
  const salt = Buffer.from(layer.salt, 'base64');
  const iv = Buffer.from(layer.iv, 'base64');
  const tag = Buffer.from(layer.tag, 'base64');
  const key = await deriveKey(material, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function collectPluginKvFallback(): PluginKvFile {
  const existing = readPluginKv();
  if (Object.keys(existing.plugins).length) return existing;
  const base = path.join(app.getPath('userData'), 'plugins');
  const plugins: Record<string, Record<string, unknown>> = {};
  try {
    if (!fs.existsSync(base)) return { schemaVersion: 1, plugins: {} };
    for (const name of fs.readdirSync(base)) {
      const pluginDir = path.join(base, name);
      const stat = fs.statSync(pluginDir);
      if (!stat.isDirectory()) continue;
      const storePath = path.join(pluginDir, 'store.json');
      if (!fs.existsSync(storePath)) continue;
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as unknown;
      if (!isRecord(parsed)) continue;
      plugins[name] = parsed;
    }
  } catch {
    return { schemaVersion: 1, plugins: {} };
  }
  return { schemaVersion: 1, plugins };
}

function pluginKvPath(): string {
  return path.join(app.getPath('userData'), 'plugin-kv.json');
}

function marketplaceStatePath(): string {
  return path.join(app.getPath('userData'), 'marketplace-state.json');
}

function snapshotFile(filePath: string): FileSnapshot {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile()) return { exists: true, kind: 'other' };
    return { exists: true, kind: 'file', content: fs.readFileSync(filePath) };
  } catch {
    return { exists: false };
  }
}

function restoreFile(filePath: string, snapshot: FileSnapshot): void {
  try {
    if (!snapshot.exists) {
      fs.rmSync(filePath, { force: true });
      return;
    }
    if (snapshot.kind !== 'file') return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, snapshot.content);
  } catch {
    return;
  }
}

function normalizePluginKv(value: unknown): PluginKvFile | undefined {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.plugins)) return undefined;
  const plugins: Record<string, Record<string, unknown>> = {};
  for (const [pluginId, data] of Object.entries(value.plugins)) {
    if (isRecord(data)) plugins[pluginId] = data;
  }
  return { schemaVersion: 1, plugins };
}

function mergeLegacyPluginStoresIntoKv(stores: Record<string, unknown>): PluginKvFile {
  const kv = readPluginKv();
  for (const [pluginId, data] of Object.entries(stores)) {
    if (!isRecord(data)) continue;
    const prev = kv.plugins[pluginId] ?? {};
    kv.plugins[pluginId] = { ...data, ...prev };
  }
  return kv;
}

function applyImportedAppState(payload: BackupPayloadV2): void {
  const snapshots = new Map<string, FileSnapshot>();
  const pluginKv = normalizePluginKv(payload.pluginKv);
  if (pluginKv) snapshots.set(pluginKvPath(), snapshotFile(pluginKvPath()));
  if (payload.marketplaceState !== undefined) {
    snapshots.set(marketplaceStatePath(), snapshotFile(marketplaceStatePath()));
  }

  try {
    if (pluginKv) writePluginKv(pluginKv);
    if (payload.marketplaceState !== undefined) writeMarketplaceState(payload.marketplaceState);
  } catch (error) {
    for (const [filePath, snapshot] of Array.from(snapshots).reverse()) {
      restoreFile(filePath, snapshot);
    }
    throw error;
  }
}

function buildBackupPayload(options: BackupExportOptions): BackupPayloadV2 {
  return {
    localStorage: options.localStorage,
    pluginKv: collectPluginKvFallback(),
    marketplaceState: readMarketplaceState(),
  };
}

export function register(): void {
  ipcMain.handle('backup:export', async (_event, input: unknown) => {
    const validated = validateBackupExportOptions(input);
    if (!validated.ok) return { success: false, error: 'invalid_params' as const };
    const options = validated.data;
    const bindToDevice = options.bindToDevice;
    const password = options.password?.trim() || undefined;
    if (password && password.length < 8) {
      return { success: false, error: 'password_too_short' as const };
    }

    const payload = buildBackupPayload(options);
    const createdAt = new Date().toISOString();
    const fileName = `DevToolBox-backup-${createdAt.replace(/[:.]/g, '-')}.dtbx`;
    const save = await dialog.showSaveDialog({
      title: 'Export',
      defaultPath: fileName,
      filters: [{ name: 'DevToolBox Backup', extensions: ['dtbx'] }],
    });
    if (save.canceled || !save.filePath) return { success: false, error: 'canceled' as const };

    const layers: BackupLayer[] = [];
    const inner = {
      schemaVersion: 2,
      createdAt,
      app: { name: 'DevToolBox', version: app.getVersion() },
      payload,
    };
    let data = Buffer.from(await gzip(Buffer.from(JSON.stringify(inner), 'utf-8'))) as AnyBuffer;
    for (const mode of backupProtectionModes({ bindToDevice, password })) {
      const material = mode === 'device' ? getDeviceId() : String(password);
      const enc = await encryptBytes(material, data);
      layers.push({ ...enc.layer, mode });
      data = enc.ciphertext;
    }

    try {
      const bin = encodeBackupBinary(layers, data);
      fs.writeFileSync(save.filePath, bin);
      return { success: true, filePath: save.filePath };
    } catch {
      return { success: false, error: 'write_failed' as const };
    }
  });

  ipcMain.handle('backup:import', async (_event, input: unknown) => {
    const validated = validateBackupImportParams(input);
    if (!validated.ok) return { success: false, error: 'invalid_params' as const };
    const params: BackupImportParams = validated.data;
    const encoding = params.encoding ?? 'utf8';
    const raw = params.content;
    let parsed: unknown;

    const password = String(params?.password ?? '').trim() || undefined;

    if (encoding === 'base64') {
      const buf = Buffer.from(raw, 'base64');
      const decoded = decodeBackupBinary(buf);
      if (!decoded) return { success: false, error: 'invalid_file' as const };
      const needsPassword = decoded.layers.some((l) => l.mode === 'password');
      if (needsPassword && !password) return { success: false, error: 'password_required' as const };
      let p: BackupPayloadV2;
      try {
        let out = decoded.ciphertext;
        for (const layer of [...decoded.layers].reverse()) {
          const material =
            layer.mode === 'builtin'
              ? getBuiltinBackupMaterial()
              : layer.mode === 'device'
                ? getDeviceId()
                : String(password ?? '');
          out = await decryptBytes(material, layer, out);
        }
        const unzipped = await gunzip(out);
        const inner = JSON.parse(unzipped.toString('utf-8')) as unknown;
        if (!isRecord(inner) || inner.schemaVersion !== 2 || !isRecord(inner.payload)) {
          return { success: false, error: 'decrypt_failed' as const };
        }
        p = inner.payload;
      } catch {
        return { success: false, error: 'decrypt_failed' as const };
      }
      try {
        applyImportedAppState({
          localStorage: p.localStorage,
          pluginKv: p.pluginKv,
          marketplaceState: p.marketplaceState,
        });
        return { success: true, localStorage: p.localStorage ?? {} };
      } catch {
        return { success: false, error: 'write_failed' as const };
      }
    }

    try {
      parsed = JSON.parse(raw);
    } catch {
      return { success: false, error: 'invalid_file' as const };
    }
    if (!isRecord(parsed) || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2))
      return { success: false, error: 'invalid_file' as const };

    if (parsed.schemaVersion === 1) {
      const file = parsed as BackupFileV1;
      let payload: BackupPayloadV1;
      try {
        if (file.encryption.mode === 'none') {
          payload = file.payload as BackupPayloadV1;
        } else {
          if (
            (file.encryption.mode === 'password' || file.encryption.mode === 'device+password') &&
            !password
          ) {
            return { success: false, error: 'password_required' as const };
          }
          const deviceId = getDeviceId();
          const material =
            file.encryption.mode === 'device'
              ? deviceId
              : file.encryption.mode === 'password'
                ? String(password ?? '')
                : `${deviceId}\n${String(password ?? '')}`;
          const layer: BackupLayer = {
            mode: 'builtin',
            alg: 'aes-256-gcm',
            kdf: 'scrypt',
            salt: file.encryption.salt,
            iv: file.encryption.iv,
            tag: file.encryption.tag,
          };
          const buf = await decryptBytes(
            material,
            layer,
            Buffer.from((file.payload as { ciphertext: string }).ciphertext, 'base64'),
          );
          const parsedPayload = JSON.parse(buf.toString('utf-8')) as unknown;
          if (!isRecord(parsedPayload)) return { success: false, error: 'decrypt_failed' as const };
          payload = parsedPayload;
        }
      } catch {
        return { success: false, error: 'decrypt_failed' as const };
      }

      try {
        applyImportedAppState({
          localStorage: payload.localStorage,
          pluginKv: payload.pluginStores ? mergeLegacyPluginStoresIntoKv(payload.pluginStores) : undefined,
          marketplaceState: payload.marketplaceState,
        });
      } catch {
        return { success: false, error: 'write_failed' as const };
      }
      return { success: true, localStorage: payload.localStorage ?? {} };
    }

    const file = parsed as BackupFileV2;
    const layers = Array.isArray(file.encryption?.layers) ? file.encryption.layers : [];
    const needsPassword = layers.some((l) => l?.mode === 'password');
    if (needsPassword && !password) return { success: false, error: 'password_required' as const };

    let p: BackupPayloadV2;
    try {
      let buf = Buffer.from(String(file.payload?.ciphertext ?? ''), 'base64') as AnyBuffer;
      for (const layer of [...layers].reverse()) {
        const mode = layer?.mode;
        const material =
          mode === 'builtin'
            ? getBuiltinBackupMaterial()
            : mode === 'device'
              ? getDeviceId()
              : String(password ?? '');
        buf = await decryptBytes(material, layer, buf);
      }
      const payload = JSON.parse(buf.toString('utf-8')) as unknown;
      if (!isRecord(payload)) return { success: false, error: 'decrypt_failed' as const };
      p = payload;
    } catch {
      return { success: false, error: 'decrypt_failed' as const };
    }
    try {
      applyImportedAppState({
        localStorage: p.localStorage,
        pluginKv: p.pluginKv,
        marketplaceState: p.marketplaceState,
      });
      return { success: true, localStorage: p.localStorage ?? {} };
    } catch {
      return { success: false, error: 'write_failed' as const };
    }
  });
}
