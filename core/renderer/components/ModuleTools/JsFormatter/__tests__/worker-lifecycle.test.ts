import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { obfuscateInWorker } from '../index';

class WorkerStub {
  static instances: WorkerStub[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    WorkerStub.instances.push(this);
  }
}

beforeEach(() => {
  WorkerStub.instances = [];
  vi.stubGlobal('Worker', WorkerStub);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('obfuscateInWorker', () => {
  it('terminates the worker and rejects with AbortError when cancelled', async () => {
    const controller = new AbortController();
    const result = obfuscateInWorker('const value = 1;', controller.signal);
    const worker = WorkerStub.instances[0];

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
  });

  it('settles once and releases the worker after a successful response', async () => {
    const controller = new AbortController();
    const result = obfuscateInWorker('const value = 1;', controller.signal);
    const worker = WorkerStub.instances[0];

    worker.onmessage?.({ data: { ok: true, result: 'const _0x1=1;' } } as MessageEvent);

    await expect(result).resolves.toBe('const _0x1=1;');
    expect(worker.terminate).toHaveBeenCalledOnce();
    controller.abort();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('terminates work that exceeds the timeout', async () => {
    const result = obfuscateInWorker('const value = 1;', new AbortController().signal);
    const worker = WorkerStub.instances[0];

    vi.advanceTimersByTime(60_000);

    await expect(result).rejects.toThrow('Obfuscation timed out');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
