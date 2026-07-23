import type { NamespacePreset, UuidVersion, V1State } from './UuidGenerator.types';

export const NS_PRESETS: Record<Exclude<NamespacePreset, 'custom'>, string> = {
  dns: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
  url: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  oid: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
  x500: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
};

export const UUID_VERSIONS: UuidVersion[] = ['nil', 'v1', 'v3', 'v4', 'v5'];

export function clampQuantity(value: string): number {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(200, Math.floor(quantity)));
}

function hexByte(value: string): number {
  const parsed = Number.parseInt(value, 16);
  return Number.isFinite(parsed) ? parsed & 0xff : 0;
}

export function parseUuid(uuid: string): Uint8Array | null {
  const value = uuid.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    return null;
  }
  const hex = value.replace(/-/g, '');
  const output = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) output[i] = hexByte(hex.slice(i * 2, i * 2 + 2));
  return output;
}

export function toUuidString(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function uuidNil(): string {
  return '00000000-0000-0000-0000-000000000000';
}

export function uuidV4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return toUuidString(bytes);
}

export function makeV1State(): V1State {
  const node = randomBytes(6);
  node[0] = node[0] | 0x01;
  const clockSeq = ((randomBytes(2)[0] << 8) | randomBytes(2)[1]) & 0x3fff;
  return { node, clockSeq, lastTime: 0n };
}

export function uuidV1(state: V1State): string {
  const epoch = 12219292800000n;
  const nowMs = BigInt(Date.now());
  let timestamp = (nowMs + epoch) * 10000n;
  if (timestamp <= state.lastTime) {
    state.clockSeq = (state.clockSeq + 1) & 0x3fff;
    timestamp = state.lastTime + 1n;
  }
  state.lastTime = timestamp;

  const timeLow = Number(timestamp & 0xffffffffn) >>> 0;
  const timeMid = Number((timestamp >> 32n) & 0xffffn) & 0xffff;
  const timeHi = Number((timestamp >> 48n) & 0x0fffn) & 0x0fff;
  const timeHiAndVersion = timeHi | 0x1000;
  const clockSeq = state.clockSeq & 0x3fff;
  const clockSeqHi = ((clockSeq >> 8) & 0x3f) | 0x80;
  const clockSeqLow = clockSeq & 0xff;

  const bytes = new Uint8Array(16);
  bytes[0] = (timeLow >>> 24) & 0xff;
  bytes[1] = (timeLow >>> 16) & 0xff;
  bytes[2] = (timeLow >>> 8) & 0xff;
  bytes[3] = timeLow & 0xff;
  bytes[4] = (timeMid >>> 8) & 0xff;
  bytes[5] = timeMid & 0xff;
  bytes[6] = (timeHiAndVersion >>> 8) & 0xff;
  bytes[7] = timeHiAndVersion & 0xff;
  bytes[8] = clockSeqHi;
  bytes[9] = clockSeqLow;
  bytes.set(state.node, 10);
  return toUuidString(bytes);
}

function add32(a: number, b: number): number {
  return (a + b) >>> 0;
}

function rol(value: number, shift: number): number {
  return (value << shift) | (value >>> (32 - shift));
}

export function md5Bytes(bytes: Uint8Array): Uint8Array {
  const origLen = bytes.length;
  const withOne = origLen + 1;
  const padLen = (withOne % 64 <= 56 ? 56 : 120) - (withOne % 64);
  const total = withOne + padLen + 8;
  const buf = new Uint8Array(total);
  buf.set(bytes, 0);
  buf[origLen] = 0x80;
  const bitLen = BigInt(origLen) * 8n;
  for (let i = 0; i < 8; i += 1) buf[total - 8 + i] = Number((bitLen >> BigInt(8 * i)) & 0xffn);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const k = new Uint32Array(64);
  for (let i = 0; i < 64; i += 1) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5,
    9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6,
    10, 15, 21, 6, 10, 15, 21,
  ];

  for (let offset = 0; offset < total; offset += 64) {
    const m = new Uint32Array(16);
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      m[i] = (buf[j] | (buf[j + 1] << 8) | (buf[j + 2] << 16) | (buf[j + 3] << 24)) >>> 0;
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i += 1) {
      let f = 0;
      let g = 0;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      const tmp = d;
      d = c;
      c = b;
      const x = add32(add32(add32(a, f >>> 0), k[i]), m[g]);
      b = add32(b, rol(x, s[i]));
      a = tmp;
    }

    a0 = add32(a0, a);
    b0 = add32(b0, b);
    c0 = add32(c0, c);
    d0 = add32(d0, d);
  }

  const output = new Uint8Array(16);
  const words = [a0, b0, c0, d0];
  for (let i = 0; i < 4; i += 1) {
    output[i * 4] = words[i] & 0xff;
    output[i * 4 + 1] = (words[i] >>> 8) & 0xff;
    output[i * 4 + 2] = (words[i] >>> 16) & 0xff;
    output[i * 4 + 3] = (words[i] >>> 24) & 0xff;
  }
  return output;
}

async function sha1(bytes: Uint8Array): Promise<Uint8Array> {
  const buffer = await crypto.subtle.digest('SHA-1', bytes as unknown as BufferSource);
  return new Uint8Array(buffer);
}

export async function uuidNameBased(version: 3 | 5, namespace: Uint8Array, name: string): Promise<string> {
  const nameBytes = new TextEncoder().encode(name);
  const merged = new Uint8Array(namespace.length + nameBytes.length);
  merged.set(namespace, 0);
  merged.set(nameBytes, namespace.length);
  const digest = version === 3 ? md5Bytes(merged) : (await sha1(merged)).slice(0, 16);
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | (version === 3 ? 0x30 : 0x50);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return toUuidString(bytes);
}

export function isNameBasedVersion(version: UuidVersion): boolean {
  return version === 'v3' || version === 'v5';
}
