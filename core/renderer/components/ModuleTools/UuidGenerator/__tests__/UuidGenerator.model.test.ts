import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampQuantity,
  isNameBasedVersion,
  md5Bytes,
  NS_PRESETS,
  parseUuid,
  toUuidString,
  uuidNameBased,
  uuidNil,
  uuidV1,
} from '../UuidGenerator.model';

describe('UuidGenerator model', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clamps quantity and validates UUID strings', () => {
    expect(clampQuantity('0')).toBe(1);
    expect(clampQuantity('201')).toBe(200);
    expect(clampQuantity('3.9')).toBe(3);
    expect(parseUuid(NS_PRESETS.dns)).toHaveLength(16);
    expect(parseUuid('bad')).toBeNull();
  });

  it('serializes UUID bytes and returns the nil UUID', () => {
    expect(toUuidString(new Uint8Array(16))).toBe(uuidNil());
  });

  it('computes MD5 bytes used by UUID v3', () => {
    const digest = md5Bytes(new TextEncoder().encode('abc'));
    const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');

    expect(hex).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it('generates known namespace UUIDs for v3 and v5', async () => {
    const namespace = parseUuid(NS_PRESETS.dns);
    expect(namespace).not.toBeNull();
    if (!namespace) return;

    await expect(uuidNameBased(3, namespace, 'www.example.com')).resolves.toBe(
      '5df41881-3aed-3515-88a7-2f4a814cf09e',
    );
    await expect(uuidNameBased(5, namespace, 'www.example.com')).resolves.toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('generates monotonic v1 UUIDs with version and variant bits', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const state = { node: new Uint8Array([1, 2, 3, 4, 5, 6]), clockSeq: 1, lastTime: 0n };

    const first = uuidV1(state);
    const second = uuidV1(state);

    expect(first[14]).toBe('1');
    expect(first[19]).toMatch(/[89ab]/);
    expect(first).not.toBe(second);
  });

  it('detects name-based versions', () => {
    expect(isNameBasedVersion('v3')).toBe(true);
    expect(isNameBasedVersion('v5')).toBe(true);
    expect(isNameBasedVersion('v4')).toBe(false);
  });
});
