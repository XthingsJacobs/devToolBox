import type { DecodedJwt } from './JwtTool.types';

const BASE64_CHUNK_SIZE = 0x8000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function base64UrlDecodeText(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlEncodeText(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

export function base64UrlToBytes(value: string): Uint8Array {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) normalized += '=';
  const bin = atob(normalized);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function highlightJson(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="json-key">$1</span>$2')
    .replace(/:\s*("(?:\\.|[^"\\])*")(?=\s*[,\n\r\]}])/g, (match: string, str: string) =>
      match.replace(str, `<span class="json-str">${str}</span>`),
    )
    .replace(/:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)(?=\s*[,\n\r\]}])/g, (match: string, num: string) =>
      match.replace(num, `<span class="json-num">${num}</span>`),
    )
    .replace(/:\s*(true|false)(?=\s*[,\n\r\]}])/g, (match: string, val: string) =>
      match.replace(val, `<span class="json-bool">${val}</span>`),
    )
    .replace(/:\s*(null)(?=\s*[,\n\r\]}])/g, (match: string, val: string) =>
      match.replace(val, `<span class="json-null">${val}</span>`),
    );
}

export function decodeJwtParts(token: string):
  | {
      ok: true;
      parts: [string, string, string];
      headerRaw: unknown;
      payloadRaw: unknown;
      header: Record<string, unknown>;
      payload: Record<string, unknown>;
      decoded: DecodedJwt;
    }
  | { ok: false }
  | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('.');
  if (parts.length !== 3) return { ok: false };
  try {
    const headerRaw = JSON.parse(base64UrlDecodeText(parts[0])) as unknown;
    const payloadRaw = JSON.parse(base64UrlDecodeText(parts[1])) as unknown;
    return {
      ok: true,
      parts: [parts[0], parts[1], parts[2]],
      headerRaw,
      payloadRaw,
      header: isRecord(headerRaw) ? headerRaw : {},
      payload: isRecord(payloadRaw) ? payloadRaw : {},
      decoded: {
        header: JSON.stringify(headerRaw, null, 2),
        payload: JSON.stringify(payloadRaw, null, 2),
        signature: parts[2],
      },
    };
  } catch {
    return { ok: false };
  }
}

export function decodeJwt(token: string): DecodedJwt | { error: true } | null {
  const decoded = decodeJwtParts(token);
  if (!decoded) return null;
  if (!decoded.ok) return { error: true };
  return decoded.decoded;
}
