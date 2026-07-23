import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRendererNavigationTarget, isRendererNavigationAllowed } from '../navigation-policy';

describe('renderer navigation policy', () => {
  it('allows only the configured development server origin', () => {
    const target = createRendererNavigationTarget(
      'http://127.0.0.1:5173/app?source=vite',
      '/unused/index.html',
    );

    expect(target).toEqual({
      entryUrl: 'http://127.0.0.1:5173/app?source=vite',
      policy: { mode: 'development', allowedOrigin: 'http://127.0.0.1:5173' },
    });
    expect(isRendererNavigationAllowed('http://127.0.0.1:5173/settings', target.policy)).toBe(true);
    expect(isRendererNavigationAllowed('http://localhost:5173/settings', target.policy)).toBe(false);
    expect(isRendererNavigationAllowed('http://127.0.0.1:5174/settings', target.policy)).toBe(false);
    expect(isRendererNavigationAllowed('https://example.com/', target.policy)).toBe(false);
  });

  it('rejects unsafe development server URLs', () => {
    expect(() => createRendererNavigationTarget('file:///tmp/index.html', '/unused/index.html')).toThrow(
      /HTTP\(S\)/,
    );
    expect(() =>
      createRendererNavigationTarget('http://user:password@localhost:5173', '/unused/index.html'),
    ).toThrow(/credentials/);
  });

  it('allows only the production entry document while preserving query and hash routing', () => {
    const entryPath = path.resolve('/Applications/DevToolBox/resources/app/dist/index.html');
    const target = createRendererNavigationTarget(undefined, entryPath);

    expect(target.policy.mode).toBe('production');
    expect(isRendererNavigationAllowed(`${target.entryUrl}?view=tools#json`, target.policy)).toBe(true);
    expect(
      isRendererNavigationAllowed(target.entryUrl.replace('/index.html', '/other.html'), target.policy),
    ).toBe(false);
    expect(isRendererNavigationAllowed('javascript:alert(1)', target.policy)).toBe(false);
    expect(isRendererNavigationAllowed('https://example.com/', target.policy)).toBe(false);
  });

  it('fails closed for malformed targets', () => {
    const target = createRendererNavigationTarget(undefined, '/tmp/devtoolbox/index.html');
    expect(isRendererNavigationAllowed('not a URL', target.policy)).toBe(false);
  });
});
