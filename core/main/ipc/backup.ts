import { app, ipcMain, dialog } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

type ExportOptions = {
  bindToDevice: boolean;
  password?: string;
  localStorage?: Record<string, string>;
};

type PluginKvFile = { schemaVersion: 1; plugins: Record<string, Record<string, unknown>> };

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

const DTBX_MAGIC = Buffer.from('DTBX', 'ascii');
const DTBX_VERSION = 3;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
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
  return { layers, ciphertext: Buffer.from(ciphertext) as AnyBuffer };
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

function deriveKey(material: string, salt: Buffer): Buffer {
  return crypto.scryptSync(material, salt, 32);
}

function encryptBytes(material: string, plaintext: AnyBuffer): { layer: BackupLayer; ciphertext: AnyBuffer } {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(material, salt);
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
    ciphertext: ciphertext as AnyBuffer,
  };
}

function decryptBytes(material: string, layer: BackupLayer, ciphertext: AnyBuffer): AnyBuffer {
  const salt = Buffer.from(layer.salt, 'base64');
  const iv = Buffer.from(layer.iv, 'base64');
  const tag = Buffer.from(layer.tag, 'base64');
  const key = deriveKey(material, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]) as AnyBuffer;
}

function readPluginKv(): PluginKvFile {
  const p = path.join(app.getPath('userData'), 'plugin-kv.json');
  try {
    if (!fs.existsSync(p)) return { schemaVersion: 1, plugins: {} };
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
    if (isRecord(parsed) && parsed.schemaVersion === 1 && isRecord(parsed.plugins)) {
      const plugins: Record<string, Record<string, unknown>> = {};
      for (const [pid, store] of Object.entries(parsed.plugins)) {
        if (!isRecord(store)) continue;
        plugins[pid] = store;
      }
      return { schemaVersion: 1, plugins };
    }
    return { schemaVersion: 1, plugins: {} };
  } catch {
    return { schemaVersion: 1, plugins: {} };
  }
}

function writePluginKv(data: PluginKvFile): void {
  const p = path.join(app.getPath('userData'), 'plugin-kv.json');
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    return;
  }
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

function applyLegacyPluginStoresToKv(stores: Record<string, unknown>): void {
  const kv = readPluginKv();
  for (const [pluginId, data] of Object.entries(stores)) {
    if (!isRecord(data)) continue;
    const prev = kv.plugins[pluginId] ?? {};
    kv.plugins[pluginId] = { ...data, ...prev };
  }
  writePluginKv(kv);
}

function readMarketplaceState(): unknown {
  const p = path.join(app.getPath('userData'), 'marketplace-state.json');
  try {
    if (!fs.existsSync(p)) return undefined;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
  } catch {
    return undefined;
  }
}

function writeMarketplaceState(data: unknown): void {
  const p = path.join(app.getPath('userData'), 'marketplace-state.json');
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    return;
  }
}

function buildBackupPayload(options: ExportOptions): BackupPayloadV2 {
  return {
    localStorage: options.localStorage,
    pluginKv: collectPluginKvFallback(),
    marketplaceState: readMarketplaceState(),
  };
}

export function register(): void {
  ipcMain.handle('backup:export', async (_event, options: ExportOptions) => {
    const bindToDevice = Boolean(options?.bindToDevice);
    const password = String(options?.password ?? '').trim() || undefined;

    const payload = buildBackupPayload(options ?? { bindToDevice: false });
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
    let data = zlib.gzipSync(Buffer.from(JSON.stringify(inner), 'utf-8')) as AnyBuffer;
    {
      const enc = encryptBytes(getBuiltinBackupMaterial(), data);
      layers.push({ ...enc.layer, mode: 'builtin' });
      data = enc.ciphertext;
    }
    if (bindToDevice) {
      const enc = encryptBytes(getDeviceId(), data);
      layers.push({ ...enc.layer, mode: 'device' });
      data = enc.ciphertext;
    }
    if (password) {
      const enc = encryptBytes(password, data);
      layers.push({ ...enc.layer, mode: 'password' });
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

  ipcMain.handle('backup:import', (_event, params: { content: string; password?: string; encoding?: string }) => {
    const encoding = String(params?.encoding ?? 'utf8').trim().toLowerCase();
    const raw = String(params?.content ?? '');
    let parsed: unknown;

    const password = String(params?.password ?? '').trim() || undefined;

    if (encoding === 'base64') {
      const buf = Buffer.from(raw, 'base64');
      const decoded = decodeBackupBinary(buf);
      if (!decoded) return { success: false, error: 'invalid_file' as const };
      const needsPassword = decoded.layers.some((l) => l.mode === 'password');
      if (needsPassword && !password) return { success: false, error: 'password_required' as const };
      try {
        let out = decoded.ciphertext;
        for (const layer of [...decoded.layers].reverse()) {
          const material =
            layer.mode === 'builtin'
              ? getBuiltinBackupMaterial()
              : layer.mode === 'device'
                ? getDeviceId()
                : String(password ?? '');
          out = decryptBytes(material, layer, out);
        }
        const unzipped = zlib.gunzipSync(out);
        const inner = JSON.parse(unzipped.toString('utf-8')) as unknown;
        if (!isRecord(inner) || inner.schemaVersion !== 2 || !isRecord(inner.payload)) {
          return { success: false, error: 'decrypt_failed' as const };
        }
        const p = inner.payload as BackupPayloadV2;
        if (p.pluginKv?.schemaVersion === 1) {
          writePluginKv(p.pluginKv);
        }
        if (p.marketplaceState !== undefined) writeMarketplaceState(p.marketplaceState);
        return { success: true, localStorage: p.localStorage ?? {} };
      } catch {
        return { success: false, error: 'decrypt_failed' as const };
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
          if ((file.encryption.mode === 'password' || file.encryption.mode === 'device+password') && !password) {
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
          const buf = decryptBytes(material, layer, Buffer.from((file.payload as { ciphertext: string }).ciphertext, 'base64') as AnyBuffer);
          const parsedPayload = JSON.parse(buf.toString('utf-8')) as unknown;
          if (!isRecord(parsedPayload)) return { success: false, error: 'decrypt_failed' as const };
          payload = parsedPayload as BackupPayloadV1;
        }
      } catch {
        return { success: false, error: 'decrypt_failed' as const };
      }

      if (payload.pluginStores && isRecord(payload.pluginStores)) applyLegacyPluginStoresToKv(payload.pluginStores);
      if (payload.marketplaceState !== undefined) writeMarketplaceState(payload.marketplaceState);
      return { success: true, localStorage: payload.localStorage ?? {} };
    }

    const file = parsed as BackupFileV2;
    const layers = Array.isArray(file.encryption?.layers) ? file.encryption.layers : [];
    const needsPassword = layers.some((l) => l?.mode === 'password');
    if (needsPassword && !password) return { success: false, error: 'password_required' as const };

    try {
      let buf = Buffer.from(String(file.payload?.ciphertext ?? ''), 'base64') as AnyBuffer;
      for (const layer of [...layers].reverse()) {
        const mode = layer?.mode;
        const material = mode === 'builtin' ? getBuiltinBackupMaterial() : mode === 'device' ? getDeviceId() : String(password ?? '');
        buf = decryptBytes(material, layer, buf);
      }
      const payload = JSON.parse(buf.toString('utf-8')) as unknown;
      if (!isRecord(payload)) return { success: false, error: 'decrypt_failed' as const };
      const p = payload as BackupPayloadV2;
      if (p.pluginKv?.schemaVersion === 1) {
        writePluginKv(p.pluginKv);
      }
      if (p.marketplaceState !== undefined) writeMarketplaceState(p.marketplaceState);
      return { success: true, localStorage: p.localStorage ?? {} };
    } catch {
      return { success: false, error: 'decrypt_failed' as const };
    }
  });
}
