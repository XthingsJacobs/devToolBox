import { ipcMain } from 'electron';
import * as dns from 'node:dns/promises';
import net from 'node:net';

type Result<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

function isForbiddenIPv4(ip: string): boolean {
  const parts = ip.split('.').map((v) => Number(v));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isForbiddenHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost') return true;
  if (h.endsWith('.local')) return true;
  if (net.isIP(h) === 4) return isForbiddenIPv4(h);
  if (net.isIP(h) === 6) return true;
  return false;
}

async function isForbiddenTarget(host: string): Promise<boolean> {
  if (isForbiddenHost(host)) return true;
  try {
    const res = await dns.lookup(host, { all: true });
    for (const r of res) {
      if (r.family === 6) return true;
      if (r.family === 4 && isForbiddenIPv4(r.address)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function register(): void {
  ipcMain.handle(
    'http:request',
    async (
      _event,
      params: {
        url: string;
        method?: string;
        headers?: Record<string, string>;
        body?: string;
        timeoutMs?: number;
        responseType?: 'text' | 'json' | 'arrayBuffer';
        allowHttp?: boolean;
      },
    ): Promise<Result<{ status: number; headers: Record<string, string>; data: unknown }>> => {
      const url = typeof params?.url === 'string' ? params.url : '';
      if (!url) return { ok: false, error: { code: 'invalid_params', message: 'Missing url' } };
      const allowHttp = Boolean(params?.allowHttp);
      const method = typeof params?.method === 'string' ? params.method.toUpperCase() : 'GET';
      const timeoutMs =
        typeof params?.timeoutMs === 'number' ? Math.max(0, Math.min(30000, params.timeoutMs)) : 15000;
      const responseType = typeof params?.responseType === 'string' ? params.responseType : 'text';
      const body = typeof params?.body === 'string' ? params.body : undefined;

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return { ok: false, error: { code: 'invalid_url', message: 'Invalid URL' } };
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { ok: false, error: { code: 'invalid_protocol', message: 'Unsupported protocol' } };
      }
      if (parsed.protocol === 'http:' && !allowHttp) {
        return { ok: false, error: { code: 'insecure_protocol', message: 'HTTP is not allowed' } };
      }
      if (await isForbiddenTarget(parsed.hostname)) {
        return { ok: false, error: { code: 'network_blocked', message: 'Forbidden target' } };
      }

      const headers =
        params?.headers && typeof params.headers === 'object'
          ? Object.fromEntries(Object.entries(params.headers).filter(([, v]) => typeof v === 'string'))
          : undefined;

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetch(parsed.toString(), { method, headers, body, signal: ac.signal });
        const maxBytes = 10 * 1024 * 1024;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > maxBytes) return { ok: false, error: { code: 'too_large', message: 'Response too large' } };

        const outHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          outHeaders[k] = v;
        });

        if (responseType === 'json') {
          try {
            return { ok: true, data: { status: res.status, headers: outHeaders, data: JSON.parse(buf.toString('utf-8')) } };
          } catch {
            return { ok: false, error: { code: 'invalid_json', message: 'Failed to parse JSON' } };
          }
        }
        if (responseType === 'arrayBuffer') {
          return { ok: true, data: { status: res.status, headers: outHeaders, data: buf.toString('base64') } };
        }
        return { ok: true, data: { status: res.status, headers: outHeaders, data: buf.toString('utf-8') } };
      } catch (e: unknown) {
        return { ok: false, error: { code: 'network_error', message: e instanceof Error ? e.message : String(e) } };
      } finally {
        clearTimeout(timer);
      }
    },
  );
}

