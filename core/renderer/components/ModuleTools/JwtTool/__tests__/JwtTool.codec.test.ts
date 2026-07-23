import { describe, expect, it } from 'vitest';
import { base64UrlDecodeText, base64UrlEncodeText, decodeJwt } from '../JwtTool.model';

describe('JwtTool codec model', () => {
  it('encodes and decodes base64url text with UTF-8 safely', () => {
    const encoded = base64UrlEncodeText('{"name":"测试","ok":true}');

    expect(encoded).not.toMatch(/[+/=]/);
    expect(base64UrlDecodeText(encoded)).toBe('{"name":"测试","ok":true}');
  });

  it('decodes JWT header, payload, and signature', () => {
    const token = `${base64UrlEncodeText('{"alg":"HS256","typ":"JWT"}')}.${base64UrlEncodeText(
      '{"sub":"123","name":"测试"}',
    )}.signature`;

    expect(decodeJwt(token)).toEqual({
      header: '{\n  "alg": "HS256",\n  "typ": "JWT"\n}',
      payload: '{\n  "sub": "123",\n  "name": "测试"\n}',
      signature: 'signature',
    });
    expect(decodeJwt('bad-token')).toEqual({ error: true });
    expect(decodeJwt('')).toBeNull();
  });
});
