import { describe, expect, it } from 'vitest';
import { normalizeAudClaim, parseAudInput, verifyOidcJwt } from '../JwtTool.model';
import { jwt, oidcLabels } from './JwtTool.test-helpers';

describe('JwtTool OIDC model', () => {
  it('normalizes audience inputs and claims', () => {
    expect(parseAudInput('api-a, api-b\napi-c')).toEqual(['api-a', 'api-b', 'api-c']);
    expect(normalizeAudClaim('api-a')).toEqual(['api-a']);
    expect(normalizeAudClaim(['api-a', 42, 'api-b'])).toEqual(['api-a', 'api-b']);
    expect(normalizeAudClaim({ aud: 'api-a' })).toEqual([]);
  });

  it('verifies OIDC tokens through discovery, JWKS filtering, signature, and claims', async () => {
    const calls: string[] = [];
    const token = jwt(
      { alg: 'RS256', typ: 'JWT', kid: 'key-1' },
      { iss: 'https://issuer.example.com', exp: 200, nbf: 50, aud: ['api-a'] },
      'c2ln',
    );

    const result = await verifyOidcJwt({
      token,
      audience: 'api-a',
      skewSeconds: 30,
      labels: oidcLabels,
      nowSeconds: 100,
      fetchJson: (url) => {
        calls.push(url);
        if (url.endsWith('/.well-known/openid-configuration')) {
          return Promise.resolve({
            ok: true,
            data: { issuer: 'https://issuer.example.com', jwks_uri: 'https://issuer.example.com/jwks' },
          });
        }
        return Promise.resolve({
          ok: true,
          data: { keys: [{ kid: 'other', kty: 'RSA', use: 'sig' }, { kid: 'key-1', kty: 'RSA', use: 'sig' }] },
        });
      },
      signatureVerifier: ({ candidates, data, signature }) => {
        expect(candidates).toHaveLength(1);
        expect(candidates[0].kid).toBe('key-1');
        expect(new TextDecoder().decode(data)).toContain('.');
        expect(new TextDecoder().decode(signature)).toBe('sig');
        return Promise.resolve({ ok: true, matchedKey: candidates[0] });
      },
    });

    expect(calls).toEqual([
      'https://issuer.example.com/.well-known/openid-configuration',
      'https://issuer.example.com/jwks',
    ]);
    expect(result.info).toEqual({ issuer: 'https://issuer.example.com', jwksUri: 'https://issuer.example.com/jwks' });
    expect(JSON.parse(result.jwksKey ?? '{}')).toMatchObject({ kid: 'key-1' });
    expect(result.result).toEqual([
      { type: 'success', msg: 'oidc start' },
      { type: 'success', msg: 'discovery ok' },
      { type: 'success', msg: 'jwks fetch ok' },
      { type: 'success', msg: 'valid' },
      { type: 'success', msg: 'exp ok' },
      { type: 'success', msg: 'nbf ok' },
      { type: 'success', msg: 'aud ok' },
      { type: 'success', msg: 'iss ok' },
    ]);
  });

  it('returns decoded OIDC data with early validation failures without fetching remote metadata', async () => {
    let fetched = false;
    const result = await verifyOidcJwt({
      token: jwt({ alg: 'HS256' }, { sub: '123' }),
      audience: '',
      skewSeconds: 0,
      labels: oidcLabels,
      fetchJson: () => {
        fetched = true;
        return Promise.resolve({ ok: false, error: { code: 'unexpected', message: 'unexpected' } });
      },
    });

    expect(fetched).toBe(false);
    expect(result.decoded?.payload).toContain('"sub": "123"');
    expect(result.result).toEqual([{ type: 'error', msg: 'missing iss' }]);
  });

  it('reports JWKS key lookup and claim validation failures for OIDC tokens', async () => {
    const missingKid = await verifyOidcJwt({
      token: jwt({ alg: 'RS256', kid: 'missing' }, { iss: 'https://issuer.example.com' }, 'c2ln'),
      audience: '',
      skewSeconds: 0,
      labels: oidcLabels,
      fetchJson: (url) =>
        Promise.resolve(
          url.endsWith('/.well-known/openid-configuration')
            ? { ok: true, data: { issuer: 'https://issuer.example.com', jwks_uri: 'https://issuer.example.com/jwks' } }
            : { ok: true, data: { keys: [{ kid: 'key-1', kty: 'RSA', use: 'sig' }] } },
        ),
    });

    expect(missingKid.result[missingKid.result.length - 1]).toEqual({ type: 'error', msg: 'kid not found' });

    const badClaims = await verifyOidcJwt({
      token: jwt(
        { alg: 'RS256', kid: 'key-1' },
        { iss: 'https://issuer.example.com', exp: 100, nbf: 300, aud: ['api-a'] },
        'c2ln',
      ),
      audience: 'api-b',
      skewSeconds: 0,
      labels: oidcLabels,
      nowSeconds: 200,
      fetchJson: (url) =>
        Promise.resolve(
          url.endsWith('/.well-known/openid-configuration')
            ? { ok: true, data: { issuer: 'https://issuer.example.com', jwks_uri: 'https://issuer.example.com/jwks' } }
            : { ok: true, data: { keys: [{ kid: 'key-1', kty: 'RSA', use: 'sig' }] } },
        ),
      signatureVerifier: ({ candidates }) => Promise.resolve({ ok: true, matchedKey: candidates[0] }),
    });

    expect(badClaims.result).toContainEqual({ type: 'error', msg: 'expired' });
    expect(badClaims.result).toContainEqual({ type: 'error', msg: 'not before' });
    expect(badClaims.result).toContainEqual({ type: 'error', msg: 'aud bad' });
  });
});
