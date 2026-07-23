import { describe, expect, it } from 'vitest';
import {
  aesEncrypt,
  base32Encode,
  buildEncodingResults,
  calculateHashes,
  crc32,
  htmlEntityEncode,
  md5,
  toHexString,
  unicodeEscape,
} from '../StringEncrypt.model';

describe('StringEncrypt model', () => {
  it('computes classic digest and encoding helpers', () => {
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(crc32('abc')).toBe('352441c2');
    expect(base32Encode('foo')).toBe('MZXW6===');
    expect(toHexString('A')).toBe('41');
    expect(unicodeEscape('AZ')).toBe('\\u0041\\u005a');
    expect(htmlEntityEncode('<>&"\'')).toBe('&#60;&#62;&#38;&#34;&#39;');
  });

  it('builds the existing encoding result rows', () => {
    expect(buildEncodingResults('a b')).toEqual([
      { label: 'Base64', value: 'YSBi' },
      { label: 'Base32', value: 'MEQGE===' },
      { label: 'URL Encode', value: 'a%20b' },
      { label: 'Hex', value: '61 20 62' },
      { label: 'Unicode', value: '\\u0061\\u0020\\u0062' },
      { label: 'HTML Entity', value: 'a b' },
    ]);
  });

  it('calculates async hashes and validates AES key length', async () => {
    const hashes = await calculateHashes('abc');

    expect(hashes.find((hash) => hash.alg === 'MD5')?.value).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(hashes.find((hash) => hash.alg === 'SHA-256')?.value).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    await expect(aesEncrypt('data', 'short', '', 'CBC')).rejects.toThrow('Key must be 16/24/32 bytes');
  });

  it('encrypts AES-CBC with a provided IV and returns hex IV', async () => {
    const result = await aesEncrypt('data', '1234567890123456', 'abcdefghijklmnop', 'CBC');

    expect(result.mode).toBe('CBC');
    expect(result.result).toBeTruthy();
    expect(result.iv).toBe('6162636465666768696a6b6c6d6e6f70');
  });
});
