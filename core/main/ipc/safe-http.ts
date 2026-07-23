import * as dns from 'node:dns/promises';
import net from 'node:net';

export type HttpResponseType = 'text' | 'json' | 'arrayBuffer';

export type ExternalHttpParams = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  responseType?: HttpResponseType;
};

export type ExternalHttpResult = {
  status: number;
  headers: Record<string, string>;
  data: unknown;
};

export class ExternalHttpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ExternalHttpError';
  }
}

function isForbiddenIPv4(ip: string): boolean {
  const parts = ip.split('.').map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value) || value < 0 || value > 255))
    return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function isForbiddenHostLiteral(host: string): boolean {
  const hostname = host.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) return true;
  if (net.isIP(hostname) === 4) return isForbiddenIPv4(hostname);
  if (net.isIP(hostname) === 6) return true;
  return false;
}

function matchesAllowedDomain(hostname: string, domain: string): boolean {
  const host = hostname.toLowerCase();
  const rule = domain.toLowerCase();
  if (!rule.startsWith('*.')) return host === rule;
  const suffix = rule.slice(2);
  if (!host.endsWith(`.${suffix}`)) return false;
  return host.split('.').length === suffix.split('.').length + 1;
}

async function assertAllowedTarget(url: URL, allowHttp: boolean, allowedDomains?: string[]): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol))
    throw new ExternalHttpError('invalid_protocol', 'Unsupported protocol');
  if (url.protocol === 'http:' && !allowHttp)
    throw new ExternalHttpError('insecure_protocol', 'HTTP is not allowed');
  if (allowedDomains && !allowedDomains.some((domain) => matchesAllowedDomain(url.hostname, domain))) {
    throw new ExternalHttpError('network_blocked', `Domain is not allowlisted: ${url.hostname}`);
  }
  if (isForbiddenHostLiteral(url.hostname))
    throw new ExternalHttpError('network_blocked', 'Forbidden target');

  try {
    const addresses = await dns.lookup(url.hostname, { all: true });
    if (addresses.some((address) => address.family === 6 || isForbiddenIPv4(address.address))) {
      throw new ExternalHttpError('network_blocked', 'Target resolves to a forbidden address');
    }
  } catch (error) {
    if (error instanceof ExternalHttpError) throw error;
    throw new ExternalHttpError('network_blocked', 'Unable to resolve target');
  }
}

export async function requestExternal(
  params: ExternalHttpParams,
  policy: { allowHttp?: boolean; allowedDomains?: string[]; maxBytes?: number } = {},
): Promise<ExternalHttpResult> {
  let currentUrl: URL;
  try {
    currentUrl = new URL(params.url);
  } catch {
    throw new ExternalHttpError('invalid_url', 'Invalid URL');
  }

  const method = typeof params.method === 'string' ? params.method.toUpperCase() : 'GET';
  const timeoutMs =
    typeof params.timeoutMs === 'number' ? Math.max(1, Math.min(30000, params.timeoutMs)) : 15000;
  const responseType: HttpResponseType =
    params.responseType === 'json' || params.responseType === 'arrayBuffer' ? params.responseType : 'text';
  const headers = params.headers
    ? Object.fromEntries(
        Object.entries(params.headers).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : undefined;
  const body = typeof params.body === 'string' ? params.body : undefined;
  const maxBytes = policy.maxBytes ?? 10 * 1024 * 1024;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response | undefined;
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      await assertAllowedTarget(currentUrl, Boolean(policy.allowHttp), policy.allowedDomains);
      response = await fetch(currentUrl, {
        method,
        headers,
        body,
        signal: controller.signal,
        redirect: 'manual',
      });

      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) break;
      if (redirects === 5) throw new ExternalHttpError('too_many_redirects', 'Too many redirects');
      currentUrl = new URL(location, currentUrl);
    }

    if (!response) throw new ExternalHttpError('network_error', 'No response');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new ExternalHttpError('too_large', 'Response too large');

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    if (responseType === 'json') {
      try {
        return {
          status: response.status,
          headers: responseHeaders,
          data: JSON.parse(buffer.toString('utf-8')),
        };
      } catch {
        throw new ExternalHttpError('invalid_json', 'Failed to parse JSON');
      }
    }
    if (responseType === 'arrayBuffer') {
      return { status: response.status, headers: responseHeaders, data: buffer.toString('base64') };
    }
    return { status: response.status, headers: responseHeaders, data: buffer.toString('utf-8') };
  } catch (error) {
    if (error instanceof ExternalHttpError) throw error;
    if (error instanceof Error && error.name === 'AbortError')
      throw new ExternalHttpError('timeout', 'Request timed out');
    throw new ExternalHttpError('network_error', error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
}
