function encodeDerLen(len: number): Uint8Array {
  if (len < 0x80) return new Uint8Array([len]);
  const bytes: number[] = [];
  let n = len;
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function trimLeadingZeros(buf: Uint8Array): Uint8Array {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) i += 1;
  return buf.slice(i);
}

function derInteger(raw: Uint8Array): Uint8Array {
  const v0 = trimLeadingZeros(raw);
  const needsPad = v0.length > 0 && (v0[0] & 0x80) !== 0;
  const v = needsPad ? new Uint8Array([0x00, ...Array.from(v0)]) : v0;
  return new Uint8Array([0x02, ...Array.from(encodeDerLen(v.length)), ...Array.from(v)]);
}

export function joseEcdsaSigToDer(sig: Uint8Array): Uint8Array | null {
  if (sig.length % 2 !== 0) return null;
  const n = sig.length / 2;
  const rDer = derInteger(sig.slice(0, n));
  const sDer = derInteger(sig.slice(n));
  const seqLen = rDer.length + sDer.length;
  const lenEnc = encodeDerLen(seqLen);
  return new Uint8Array([0x30, ...Array.from(lenEnc), ...Array.from(rDer), ...Array.from(sDer)]);
}

export async function importVerifyKeyFromJwk(alg: string, jwk: JsonWebKey): Promise<CryptoKey> {
  if (alg === 'RS256') {
    return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
      'verify',
    ]);
  }
  if (alg === 'RS384') {
    return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' }, false, [
      'verify',
    ]);
  }
  if (alg === 'RS512') {
    return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' }, false, [
      'verify',
    ]);
  }
  if (alg === 'ES256') {
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  }
  if (alg === 'ES384') {
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-384' }, false, ['verify']);
  }
  if (alg === 'ES512') {
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-521' }, false, ['verify']);
  }
  throw new Error(`Unsupported alg: ${alg}`);
}

export async function verifyWithKey(
  alg: string,
  key: CryptoKey,
  data: Uint8Array,
  sig: Uint8Array,
): Promise<boolean> {
  if (alg.startsWith('RS')) {
    const hash = alg === 'RS256' ? 'SHA-256' : alg === 'RS384' ? 'SHA-384' : 'SHA-512';
    return crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5', hash },
      key,
      sig as unknown as BufferSource,
      data as unknown as BufferSource,
    );
  }
  if (alg.startsWith('ES')) {
    const hash = alg === 'ES256' ? 'SHA-256' : alg === 'ES384' ? 'SHA-384' : 'SHA-512';
    const der = joseEcdsaSigToDer(sig);
    if (!der) return false;
    return crypto.subtle.verify(
      { name: 'ECDSA', hash },
      key,
      der as unknown as BufferSource,
      data as unknown as BufferSource,
    );
  }
  return false;
}
