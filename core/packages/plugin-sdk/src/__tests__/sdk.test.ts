import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('@devtoolbox/plugin-sdk', () => {
  it('sends a request to the configured host and clears its timeout after a valid response', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/?hostOrigin=https%3A%2F%2Fhost.example');
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    vi.resetModules();
    const { callSdk } = await import('../index');

    const response = callSdk<string>('storage.get', { key: 'setting' }, 1000);
    expect(postMessage).toHaveBeenCalledTimes(1);
    const request = postMessage.mock.calls[0][0] as { requestId: string; method: string };
    expect(request.method).toBe('storage.get');
    expect(postMessage.mock.calls[0][1]).toBe('https://host.example');

    const event = new MessageEvent('message', {
      data: {
        type: 'devtoolbox:sdk:response',
        requestId: request.requestId,
        ok: true,
        data: 'compact',
      },
      origin: 'https://host.example',
    });
    Object.defineProperty(event, 'source', { value: window.parent });
    window.dispatchEvent(event);

    await expect(response).resolves.toEqual({ ok: true, data: 'compact' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns a structured timeout for unanswered requests', async () => {
    vi.useFakeTimers();
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    vi.resetModules();
    const { callSdk } = await import('../index');

    const response = callSdk('system.getInfo', undefined, 10);
    expect(postMessage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10);
    await expect(response).resolves.toEqual({
      ok: false,
      error: { code: 'timeout', message: 'SDK request timeout' },
    });
  });
});
