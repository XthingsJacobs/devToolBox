import { describe, expect, it } from 'vitest';
import { PluginTokenStore } from '../token-store';

describe('PluginTokenStore', () => {
  it('scopes issued tokens to the owning plugin', () => {
    const store = new PluginTokenStore();
    const token = store.issue('market-owner', '/tmp/example.txt');

    expect(store.resolve('market-owner', token)).toBe('/tmp/example.txt');
    expect(store.resolve('market-other', token)).toBeUndefined();
  });

  it('revokes all tokens when a plugin is cleared', () => {
    const store = new PluginTokenStore();
    const token = store.issue('market-owner', '/tmp/example.txt');

    store.clear('market-owner');
    expect(store.resolve('market-owner', token)).toBeUndefined();
  });
});
