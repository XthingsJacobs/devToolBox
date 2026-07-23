import type { AesMode, AesResult, EncodedResult, HashResult, HmacResult } from './StringEncrypt.types';

export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function toArrayBufferView(buffer: Uint8Array): Uint8Array<ArrayBuffer> {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return new Uint8Array<ArrayBuffer>(arrayBuffer);
}

export async function hash(algorithm: string, data: string): Promise<string> {
  const buffer = await crypto.subtle.digest(algorithm, new TextEncoder().encode(data));
  return toHex(buffer);
}

export async function hmac(algorithm: string, key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const importedKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );
  const buffer = await crypto.subtle.sign('HMAC', importedKey, encoder.encode(data));
  return toHex(buffer);
}

export async function aesEncrypt(
  data: string,
  keyString: string,
  ivString: string,
  mode: AesMode,
): Promise<AesResult> {
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(keyString);
  if (![16, 24, 32].includes(keyBuffer.length)) throw new Error('Key must be 16/24/32 bytes');
  const dataBuffer = encoder.encode(data);

  if (mode === 'CBC') {
    let ivBuffer: Uint8Array;
    if (ivString) {
      ivBuffer = encoder.encode(ivString);
      if (ivBuffer.length !== 16) throw new Error('IV must be 16 bytes');
    } else {
      ivBuffer = crypto.getRandomValues(new Uint8Array(16));
    }
    const key = await crypto.subtle.importKey('raw', keyBuffer, 'AES-CBC', false, ['encrypt']);
    const iv = toArrayBufferView(ivBuffer);
    const buffer = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, dataBuffer);
    return { mode, result: toBase64(buffer), iv: toHex(iv.buffer) };
  }

  const iv = toArrayBufferView(crypto.getRandomValues(new Uint8Array(12)));
  const key = await crypto.subtle.importKey('raw', keyBuffer, 'AES-GCM', false, ['encrypt']);
  const buffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dataBuffer);
  return { mode, result: toBase64(buffer), iv: toHex(iv.buffer) };
}

export function crc32(input: string): string {
  let crc = 0xffffffff;
  const bytes = new TextEncoder().encode(input);
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export function toHexString(input: string): string {
  return Array.from(new TextEncoder().encode(input), (byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

export function base32Encode(input: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = new TextEncoder().encode(input);
  let bits = 0;
  let value = 0;
  let result = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >>> bits) & 31];
    }
  }
  if (bits > 0) result += alphabet[(value << (5 - bits)) & 31];
  while (result.length % 8) result += '=';
  return result;
}

export function md5(input: string): string {
  function rotl(value: number, shift: number) {
    return (value << shift) | (value >>> (32 - shift));
  }
  function toWords(value: string) {
    const length = value.length;
    const words: number[] = [];
    for (let i = 0; i < length; i += 1) words[i >> 2] |= (value.charCodeAt(i) & 0xff) << ((i % 4) * 8);
    words[length >> 2] |= 0x80 << ((length % 4) * 8);
    words[(((length + 8) >>> 6) << 4) + 14] = length * 8;
    return words;
  }
  const k = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5,
    9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6,
    10, 15, 21, 6, 10, 15, 21,
  ];
  const words = toWords(unescape(encodeURIComponent(input)));
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  for (let i = 0; i < words.length; i += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;
    for (let j = 0; j < 64; j += 1) {
      let f: number;
      let g: number;
      if (j < 16) {
        f = (b & c) | (~b & d);
        g = j;
      } else if (j < 32) {
        f = (d & b) | (~d & c);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = b ^ c ^ d;
        g = (3 * j + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * j) % 16;
      }
      const tmp = d;
      d = c;
      c = b;
      b = (b + rotl((a + f + k[j] + (words[i + g] | 0)) | 0, s[j])) | 0;
      a = tmp;
    }
    a = (a + aa) | 0;
    b = (b + bb) | 0;
    c = (c + cc) | 0;
    d = (d + dd) | 0;
  }
  return [a, b, c, d]
    .map((value) => {
      let output = '';
      for (let i = 0; i < 4; i += 1) output += ((value >> (i * 8)) & 0xff).toString(16).padStart(2, '0');
      return output;
    })
    .join('');
}

export function unicodeEscape(input: string): string {
  return Array.from(input)
    .map((character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .join('');
}

export function htmlEntityEncode(input: string): string {
  return input.replace(/[<>&"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

export function buildEncodingResults(input: string): EncodedResult[] {
  return [
    { label: 'Base64', value: btoa(unescape(encodeURIComponent(input))) },
    { label: 'Base32', value: base32Encode(input) },
    { label: 'URL Encode', value: encodeURIComponent(input) },
    { label: 'Hex', value: toHexString(input) },
    { label: 'Unicode', value: unicodeEscape(input) },
    { label: 'HTML Entity', value: htmlEntityEncode(input) },
  ];
}

export async function calculateHashes(input: string): Promise<HashResult[]> {
  const algorithms: { alg: string; label: string }[] = [
    { alg: 'SHA-1', label: 'SHA-1' },
    { alg: 'SHA-256', label: 'SHA-256' },
    { alg: 'SHA-384', label: 'SHA-384' },
    { alg: 'SHA-512', label: 'SHA-512' },
  ];
  try {
    const results = await Promise.all(
      algorithms.map(async (algorithm) => ({
        alg: algorithm.alg,
        label: algorithm.label,
        value: await hash(algorithm.alg, input),
      })),
    );
    return [
      { alg: 'MD5', label: 'MD5', value: md5(input) },
      ...results,
      { alg: 'CRC32', label: 'CRC32', value: crc32(input) },
    ];
  } catch {
    return [
      { alg: 'MD5', label: 'MD5', value: md5(input) },
      { alg: 'CRC32', label: 'CRC32', value: crc32(input) },
    ];
  }
}

export async function calculateHmacs(input: string, key: string): Promise<HmacResult[]> {
  const algorithms = [
    { alg: 'SHA-1', label: 'HMAC-SHA1' },
    { alg: 'SHA-256', label: 'HMAC-SHA256' },
    { alg: 'SHA-384', label: 'HMAC-SHA384' },
    { alg: 'SHA-512', label: 'HMAC-SHA512' },
  ];
  return Promise.all(
    algorithms.map(async (algorithm) => ({
      alg: algorithm.alg,
      label: algorithm.label,
      value: await hmac(algorithm.alg, key, input),
    })),
  );
}
