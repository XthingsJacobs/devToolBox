import { describe, expect, it } from 'vitest';
import { joseEcdsaSigToDer } from '../JwtTool.model';

describe('JwtTool crypto model', () => {
  it('converts JOSE ECDSA signatures into DER sequence format', () => {
    expect(Array.from(joseEcdsaSigToDer(new Uint8Array([0, 1, 0x80, 2])) ?? [])).toEqual([
      0x30, 0x08, 0x02, 0x01, 0x01, 0x02, 0x03, 0x00, 0x80, 0x02,
    ]);
    expect(joseEcdsaSigToDer(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
