import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dns from 'node:dns/promises';
import { requestExternal } from '../safe-http';

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

function fakeResponse(status: number, body = '', headers: Record<string, string> = {}): Response {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const bytes = new TextEncoder().encode(body);
  return {
    status,
    headers: {
      get: (key: string) => normalized[key.toLowerCase()] ?? null,
      forEach: (callback: (value: string, key: string) => void) => {
        Object.entries(normalized).forEach(([key, value]) => callback(value, key));
      },
    },
    arrayBuffer: () => Promise.resolve(bytes.buffer),
  } as unknown as Response;
}

describe('requestExternal', () => {
  const lookup = vi.mocked(dns.lookup);
  const fetchMock = vi.fn();

  beforeEach(() => {
    lookup.mockReset();
    fetchMock.mockReset();
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('blocks local targets before making a request', async () => {
    await expect(requestExternal({ url: 'https://localhost/data' })).rejects.toMatchObject({
      code: 'network_blocked',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enforces exact and single-level wildcard domain rules', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, '{"ok":true}', { 'content-type': 'application/json' }));

    const result = await requestExternal(
      { url: 'https://api.example.com/data', responseType: 'json' },
      { allowedDomains: ['*.example.com'] },
    );
    expect(result.data).toEqual({ ok: true });

    await expect(
      requestExternal({ url: 'https://deep.api.example.com/data' }, { allowedDomains: ['*.example.com'] }),
    ).rejects.toMatchObject({ code: 'network_blocked' });
  });

  it('validates every redirect target against the same policy', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(302, '', { location: 'https://blocked.example.net/data' }));

    await expect(
      requestExternal({ url: 'https://api.example.com/data' }, { allowedDomains: ['api.example.com'] }),
    ).rejects.toMatchObject({ code: 'network_blocked' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks hostnames that resolve to private addresses', async () => {
    lookup.mockResolvedValue([{ address: '192.168.1.20', family: 4 }] as never);

    await expect(requestExternal({ url: 'https://example.com/data' })).rejects.toMatchObject({
      code: 'network_blocked',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
