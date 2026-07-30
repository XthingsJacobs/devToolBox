import type { OidcVerifierState, VerifyMessage } from './JwtTool.types';
import { base64UrlToBytes, decodeJwtParts, isRecord } from './JwtTool.codec';
import { importVerifyKeyFromJwk, verifyWithKey } from './JwtTool.crypto';

export type JwtJsonFetchResult =
  { ok: true; data: unknown } | { ok: false; error?: { code: string; message: string } };

export type JwtJsonFetcher = (url: string) => Promise<JwtJsonFetchResult>;

export interface OidcVerifyLabels {
  decodeError: string;
  oidcMissingIss: string;
  oidcHmacNotSupported: string;
  oidcUnsupportedAlg: string;
  oidcStart: string;
  oidcDiscoveryFailed: string;
  oidcInvalidDiscovery: string;
  oidcIssuerMismatch: string;
  oidcDiscoveryOk: string;
  jwksFetchFailed: string;
  jwksNoKeys: string;
  jwksFetchOk: string;
  jwksKidNotFound: string;
  verifyValid: string;
  verifyInvalid: string;
  claimsMissingExp: string;
  verifyExpired: string;
  claimsExpOk: string;
  verifyNotBefore: string;
  claimsNbfOk: string;
  claimsMissingAud: string;
  claimsAudOk: string;
  claimsAudBad: string;
  claimsIssOk: string;
  claimsIssBad: string;
}

export interface OidcSignatureVerifierParams {
  alg: string;
  candidates: Record<string, unknown>[];
  data: Uint8Array;
  signature: Uint8Array;
}

export type OidcSignatureVerifier = (
  params: OidcSignatureVerifierParams,
) => Promise<{ ok: boolean; matchedKey: Record<string, unknown> | null }>;

export interface OidcVerifyOptions {
  token: string;
  audience: string;
  skewSeconds: number;
  labels: OidcVerifyLabels;
  fetchJson: JwtJsonFetcher;
  nowSeconds?: number;
  signatureVerifier?: OidcSignatureVerifier;
}

export function parseAudInput(value: string): string[] {
  return value
    .split(/[,\n\r]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeAudClaim(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return [];
}

function oidcResult(overrides: Partial<OidcVerifierState> = {}): OidcVerifierState {
  return {
    result: [],
    info: null,
    decoded: null,
    jwksKid: '',
    jwksKey: null,
    ...overrides,
  };
}

export async function verifyOidcSignatureWithJwks({
  alg,
  candidates,
  data,
  signature,
}: OidcSignatureVerifierParams): Promise<{ ok: boolean; matchedKey: Record<string, unknown> | null }> {
  for (const candidate of candidates) {
    try {
      const key = await importVerifyKeyFromJwk(alg, candidate);
      const ok = await verifyWithKey(alg, key, data, signature);
      if (ok) return { ok: true, matchedKey: candidate };
    } catch {
      continue;
    }
  }
  return { ok: false, matchedKey: null };
}

export async function verifyOidcJwt({
  token,
  audience,
  skewSeconds,
  labels,
  fetchJson,
  nowSeconds = Math.floor(Date.now() / 1000),
  signatureVerifier = verifyOidcSignatureWithJwks,
}: OidcVerifyOptions): Promise<OidcVerifierState> {
  const trimmed = token.trim();
  if (!trimmed) return oidcResult();

  const parsed = decodeJwtParts(trimmed);
  if (!parsed || !parsed.ok) return oidcResult({ result: [{ type: 'error', msg: labels.decodeError }] });

  const { parts, header, payload, decoded } = parsed;
  const alg = typeof header.alg === 'string' ? header.alg : '';
  const issuerClaim = typeof payload.iss === 'string' ? payload.iss : '';
  const kid = typeof header.kid === 'string' ? header.kid : '';

  const withDecoded = (result: VerifyMessage[], extra: Partial<OidcVerifierState> = {}) =>
    oidcResult({ decoded, result, ...extra });

  if (!issuerClaim) return withDecoded([{ type: 'error', msg: labels.oidcMissingIss }]);
  if (!alg || alg.startsWith('HS')) {
    return withDecoded([{ type: 'warning', msg: labels.oidcHmacNotSupported }]);
  }
  if (!alg.startsWith('RS') && !alg.startsWith('ES')) {
    return withDecoded([{ type: 'warning', msg: `${labels.oidcUnsupportedAlg}: ${alg}` }]);
  }

  const result: VerifyMessage[] = [{ type: 'success', msg: labels.oidcStart }];
  const issuer = issuerClaim.replace(/\/+$/g, '');
  const discovery = await fetchJson(`${issuer}/.well-known/openid-configuration`);
  if (!discovery.ok || !isRecord(discovery.data)) {
    return withDecoded([...result, { type: 'error', msg: labels.oidcDiscoveryFailed }]);
  }

  const issuerFromConfig = typeof discovery.data.issuer === 'string' ? discovery.data.issuer : '';
  const jwksUri = typeof discovery.data.jwks_uri === 'string' ? discovery.data.jwks_uri : '';
  if (!issuerFromConfig || !jwksUri) {
    return withDecoded([...result, { type: 'error', msg: labels.oidcInvalidDiscovery }]);
  }
  if (issuerFromConfig !== issuer) {
    return withDecoded([...result, { type: 'error', msg: labels.oidcIssuerMismatch }]);
  }

  const info = { issuer: issuerFromConfig, jwksUri };
  result.push({ type: 'success', msg: labels.oidcDiscoveryOk });

  const jwksRes = await fetchJson(jwksUri);
  if (!jwksRes.ok || !isRecord(jwksRes.data)) {
    return withDecoded([...result, { type: 'error', msg: labels.jwksFetchFailed }], { info });
  }

  const keysUnknown = jwksRes.data.keys;
  const keys = Array.isArray(keysUnknown)
    ? keysUnknown.filter((key): key is Record<string, unknown> => isRecord(key))
    : [];
  if (!keys.length) return withDecoded([...result, { type: 'error', msg: labels.jwksNoKeys }], { info });

  result.push({ type: 'success', msg: labels.jwksFetchOk });

  const candidates = keys.filter((key) => {
    const use = typeof key.use === 'string' ? key.use : '';
    if (use && use !== 'sig') return false;
    const kty = typeof key.kty === 'string' ? key.kty : '';
    if (alg.startsWith('RS') && kty !== 'RSA') return false;
    if (alg.startsWith('ES') && kty !== 'EC') return false;
    return true;
  });
  const byKid = kid
    ? candidates.filter((key) => (typeof key.kid === 'string' ? key.kid : '') === kid)
    : candidates;
  if (!byKid.length) {
    return withDecoded([...result, { type: 'error', msg: labels.jwksKidNotFound }], { info });
  }

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  let signature: Uint8Array;
  try {
    signature = base64UrlToBytes(parts[2]);
  } catch {
    return withDecoded([...result, { type: 'error', msg: labels.verifyInvalid }], {
      info,
      jwksKid: kid,
      jwksKey: JSON.stringify(byKid[0], null, 2),
    });
  }

  let signatureResult: { ok: boolean; matchedKey: Record<string, unknown> | null };
  try {
    signatureResult = await signatureVerifier({ alg, candidates: byKid, data, signature });
  } catch {
    signatureResult = { ok: false, matchedKey: null };
  }

  const selectedKey = signatureResult.matchedKey ?? byKid[0];
  const jwksKey = JSON.stringify(selectedKey, null, 2);
  result.push({
    type: signatureResult.ok ? 'success' : 'error',
    msg: signatureResult.ok ? labels.verifyValid : labels.verifyInvalid,
  });
  if (!signatureResult.ok) return withDecoded(result, { info, jwksKid: kid, jwksKey });

  const skew = Math.max(0, Math.min(3600, Number.isFinite(skewSeconds) ? skewSeconds : 0));
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : undefined;
  const audClaim = normalizeAudClaim(payload.aud);
  const expectedAud = parseAudInput(audience);

  if (exp == null) result.push({ type: 'warning', msg: labels.claimsMissingExp });
  else if (nowSeconds > exp + skew) result.push({ type: 'error', msg: labels.verifyExpired });
  else result.push({ type: 'success', msg: labels.claimsExpOk });

  if (nbf != null && nowSeconds + skew < nbf) result.push({ type: 'error', msg: labels.verifyNotBefore });
  else if (nbf != null) result.push({ type: 'success', msg: labels.claimsNbfOk });

  if (!audClaim.length) result.push({ type: 'warning', msg: labels.claimsMissingAud });
  else if (expectedAud.length) {
    const audOk = expectedAud.some((item) => audClaim.includes(item));
    result.push({ type: audOk ? 'success' : 'error', msg: audOk ? labels.claimsAudOk : labels.claimsAudBad });
  } else {
    result.push({ type: 'success', msg: labels.claimsAudOk });
  }

  if (issuerFromConfig === issuerClaim) result.push({ type: 'success', msg: labels.claimsIssOk });
  else result.push({ type: 'error', msg: labels.claimsIssBad });

  return withDecoded(result, { info, jwksKid: kid, jwksKey });
}
