import { app, protocol } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { MarketplacePluginManifest } from '@devtoolbox/core';
import { pluginRepository } from '../marketplace/plugin-repository';

export const PLUGIN_SCHEME = 'devtoolbox-plugin';

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function cspSource(domain: string): string | undefined {
  const value = domain.trim().toLowerCase();
  if (!value || value.includes('://') || value.includes('/')) return undefined;
  if (value.startsWith('*.')) return `https://*.${value.slice(2)}`;
  return `https://${value}`;
}

export function buildPluginContentSecurityPolicy(manifest: MarketplacePluginManifest): string {
  const networkSources = (manifest.httpDomains ?? [])
    .map(cspSource)
    .filter((value): value is string => Boolean(value))
    .sort();
  const connectSrc = ["'self'", ...networkSources].join(' ');
  const imageSrc = ["'self'", 'data:', 'blob:', ...networkSources].join(' ');

  return [
    "default-src 'self'",
    "base-uri 'none'",
    `connect-src ${connectSrc}`,
    "font-src 'self' data:",
    "form-action 'none'",
    "frame-src 'none'",
    `img-src ${imageSrc}`,
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
  ].join('; ');
}

export function resolvePluginRequestPath(
  requestUrl: string,
  installBaseDir: string,
): { pluginId: string; version: string; filePath: string } | undefined {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== `${PLUGIN_SCHEME}:`) return undefined;

  const pluginId = url.hostname.toLowerCase();
  if (!/^market-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pluginId)) return undefined;

  let segments: string[];
  try {
    segments = url.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return undefined;
  }
  const [version, ...entrySegments] = segments;
  if (!version || !entrySegments.length || entrySegments.some((segment) => !segment)) return undefined;

  const pluginRoot = path.resolve(installBaseDir, pluginId, version);
  const filePath = path.resolve(pluginRoot, ...entrySegments);
  if (!filePath.startsWith(`${pluginRoot}${path.sep}`)) return undefined;
  return { pluginId, version, filePath };
}

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
    },
  });
}

export function registerPluginScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PLUGIN_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        codeCache: true,
      },
    },
  ]);
}

export function registerPluginProtocol(options?: { runtimeEnabled?: () => boolean }): void {
  if (protocol.isProtocolHandled(PLUGIN_SCHEME)) return;
  const installBaseDir = path.join(app.getPath('userData'), 'modules');

  protocol.handle(PLUGIN_SCHEME, (request) => {
    if (options?.runtimeEnabled && !options.runtimeEnabled()) {
      return errorResponse(503, 'Plugins are unavailable in safe mode');
    }
    const resolved = resolvePluginRequestPath(request.url, installBaseDir);
    if (!resolved) return errorResponse(400, 'Invalid plugin URL');

    const installed = pluginRepository.get(resolved.pluginId);
    if (!installed || !installed.enabled || installed.version !== resolved.version) {
      return errorResponse(404, 'Plugin not available');
    }

    try {
      const pluginRoot = fs.realpathSync(path.join(installBaseDir, resolved.pluginId, resolved.version));
      const realPath = fs.realpathSync(resolved.filePath);
      if (!realPath.startsWith(`${pluginRoot}${path.sep}`)) return errorResponse(403, 'Forbidden');
      const stat = fs.statSync(realPath);
      if (!stat.isFile()) return errorResponse(404, 'Plugin asset not found');

      const headers: Record<string, string> = {
        'content-type': MIME_TYPES[path.extname(realPath).toLowerCase()] ?? 'application/octet-stream',
        'x-content-type-options': 'nosniff',
      };
      if (path.extname(realPath).toLowerCase() === '.html') {
        headers['content-security-policy'] = buildPluginContentSecurityPolicy(installed.manifest);
        headers['cache-control'] = 'no-store';
      }
      const body = request.method === 'HEAD' ? undefined : new Uint8Array(fs.readFileSync(realPath));
      return new Response(body, { status: 200, headers });
    } catch {
      return errorResponse(404, 'Plugin asset not found');
    }
  });
}

export function pluginEntryUrl(
  manifest: Pick<MarketplacePluginManifest, 'id' | 'version' | 'entry'>,
): string {
  const entry = manifest.entry
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${PLUGIN_SCHEME}://${manifest.id}/${encodeURIComponent(manifest.version)}/${entry}`;
}
