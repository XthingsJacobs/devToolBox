import { describe, expect, it } from 'vitest';
import { decodeJwtParts, generateHmacJwt, verifyHmacJwt } from '../JwtTool.model';
import { labels } from './JwtTool.test-helpers';

describe('JwtTool HMAC model', () => {
  it('generates and verifies HMAC JWTs', async () => {
    const generated = await generateHmacJwt(
      'HS256',
      'secret',
      '{"typ":"JWT"}',
      '{"sub":"123","exp":4102444800,"nbf":946684800}',
    );

    expect(generated.ok).toBe(true);
    if (!generated.ok) return;

    const parsed = decodeJwtParts(generated.token);
    expect(parsed?.ok).toBe(true);
    if (!parsed?.ok) return;
    expect(parsed.header.alg).toBe('HS256');
    expect(parsed.header.typ).toBe('JWT');

    await expect(verifyHmacJwt(generated.token, 'secret', labels, 1_700_000_000)).resolves.toEqual([
      { type: 'success', msg: 'valid' },
    ]);
    await expect(verifyHmacJwt(generated.token, 'wrong', labels, 1_700_000_000)).resolves.toEqual([
      { type: 'error', msg: 'invalid' },
    ]);
  });

  it('reports expired and not-before claims for signed HMAC JWTs', async () => {
    const expired = await generateHmacJwt('HS256', 'secret', '{"typ":"JWT"}', '{"exp":100,"nbf":300}');

    expect(expired.ok).toBe(true);
    if (!expired.ok) return;

    await expect(verifyHmacJwt(expired.token, 'secret', labels, 200)).resolves.toEqual([
      { type: 'success', msg: 'valid' },
      { type: 'warning', msg: 'expired' },
      { type: 'warning', msg: 'not before' },
    ]);
  });

  it('rejects unsupported generated algorithms and malformed tokens', async () => {
    await expect(generateHmacJwt('RS256', 'secret', '{}', '{}')).resolves.toEqual({
      ok: false,
      error: 'RS256: HMAC only',
    });
    await expect(verifyHmacJwt('bad-token', 'secret', labels)).resolves.toEqual([
      { type: 'error', msg: 'decode error' },
    ]);
  });
});
