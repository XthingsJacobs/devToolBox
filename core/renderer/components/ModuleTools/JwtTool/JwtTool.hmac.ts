import type { VerifyMessage } from './JwtTool.types';
import { base64UrlEncodeBytes, base64UrlEncodeText, decodeJwtParts, isRecord } from './JwtTool.codec';

const HMAC_HASHES: Record<string, string> = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };

export async function signHmacJwtData(alg: string, secret: string, data: string): Promise<string> {
  const hash = HMAC_HASHES[alg];
  if (!hash) throw new Error(`Unsupported alg: ${alg}`);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

export async function verifyHmacJwt(
  token: string,
  secret: string,
  labels: {
    decodeError: string;
    verifyValid: string;
    verifyInvalid: string;
    verifyExpired: string;
    verifyNotBefore: string;
  },
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<VerifyMessage[]> {
  const parsed = decodeJwtParts(token);
  if (!parsed?.ok) return [{ type: 'error', msg: labels.decodeError }];

  try {
    const alg = typeof parsed.header.alg === 'string' ? parsed.header.alg : '';
    const result: VerifyMessage[] = [];
    if (alg.startsWith('HS')) {
      const sig = await signHmacJwtData(alg, secret, `${parsed.parts[0]}.${parsed.parts[1]}`);
      const ok = sig === parsed.parts[2];
      result.push({ type: ok ? 'success' : 'error', msg: ok ? labels.verifyValid : labels.verifyInvalid });
    } else {
      result.push({ type: 'warning', msg: `${alg}: HMAC only` });
    }

    const exp = typeof parsed.payload.exp === 'number' ? parsed.payload.exp : undefined;
    const nbf = typeof parsed.payload.nbf === 'number' ? parsed.payload.nbf : undefined;
    if (exp != null && nowSeconds > exp) result.push({ type: 'warning', msg: labels.verifyExpired });
    if (nbf != null && nowSeconds < nbf) result.push({ type: 'warning', msg: labels.verifyNotBefore });
    return result;
  } catch {
    return [{ type: 'error', msg: labels.decodeError }];
  }
}

export async function generateHmacJwt(
  alg: string,
  secret: string,
  headerJson: string,
  payloadJson: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const headerUnknown = JSON.parse(headerJson) as unknown;
    const header = isRecord(headerUnknown) ? headerUnknown : {};
    header.alg = alg;
    if (typeof header.typ !== 'string' || !header.typ) header.typ = 'JWT';
    const headerB64 = base64UrlEncodeText(JSON.stringify(header));
    const payloadB64 = base64UrlEncodeText(JSON.stringify(JSON.parse(payloadJson) as unknown));
    const data = `${headerB64}.${payloadB64}`;
    if (!alg.startsWith('HS')) return { ok: false, error: `${alg}: HMAC only` };
    return { ok: true, token: `${data}.${await signHmacJwtData(alg, secret, data)}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to generate token' };
  }
}
