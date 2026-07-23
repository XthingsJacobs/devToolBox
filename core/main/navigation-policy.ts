import { pathToFileURL } from 'node:url';

export type RendererNavigationPolicy =
  | { mode: 'development'; allowedOrigin: string }
  | { mode: 'production'; entryDocumentUrl: string };

export interface RendererNavigationTarget {
  entryUrl: string;
  policy: RendererNavigationPolicy;
}

function documentUrl(url: URL): string {
  const normalized = new URL(url);
  normalized.hash = '';
  normalized.search = '';
  return normalized.href;
}

export function createRendererNavigationTarget(
  devServerUrl: string | undefined,
  rendererEntryPath: string,
): RendererNavigationTarget {
  if (devServerUrl) {
    const url = new URL(devServerUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('VITE_DEV_SERVER_URL must use HTTP(S) without embedded credentials');
    }
    return {
      entryUrl: url.href,
      policy: { mode: 'development', allowedOrigin: url.origin },
    };
  }

  const entryUrl = pathToFileURL(rendererEntryPath).href;
  return {
    entryUrl,
    policy: { mode: 'production', entryDocumentUrl: documentUrl(new URL(entryUrl)) },
  };
}

export function isRendererNavigationAllowed(targetUrl: string, policy: RendererNavigationPolicy): boolean {
  let target: URL;
  try {
    target = new URL(targetUrl);
  } catch {
    return false;
  }

  if (target.username || target.password) return false;
  if (policy.mode === 'development') {
    return ['http:', 'https:'].includes(target.protocol) && target.origin === policy.allowedOrigin;
  }
  return target.protocol === 'file:' && documentUrl(target) === policy.entryDocumentUrl;
}
