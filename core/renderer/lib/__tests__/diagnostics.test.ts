import { afterEach, describe, expect, it, vi } from 'vitest';
import { installRendererDiagnostics, recordDiagnostic } from '../diagnostics';

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: undefined });
});

describe('renderer diagnostics', () => {
  it('forwards global errors and unhandled rejections through the typed preload API', () => {
    const diagnosticsRecord = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { diagnosticsRecord },
    });
    const cleanup = installRendererDiagnostics();

    const error = new Error('renderer failed');
    window.dispatchEvent(
      new ErrorEvent('error', {
        error,
        message: error.message,
        filename: '/Users/example/app.js',
        lineno: 10,
        colno: 4,
      }),
    );
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: new Error('request failed') });
    window.dispatchEvent(rejection);

    expect(diagnosticsRecord).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ source: 'renderer', scope: 'window.error', message: 'renderer failed' }),
    );
    expect(diagnosticsRecord).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        source: 'renderer',
        scope: 'unhandled-rejection',
        message: 'request failed',
      }),
    );
    cleanup();
  });

  it('never throws when diagnostics are unavailable or rejected', () => {
    expect(() =>
      recordDiagnostic({ level: 'warn', source: 'renderer', message: 'without preload' }),
    ).not.toThrow();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { diagnosticsRecord: vi.fn().mockRejectedValue(new Error('offline')) },
    });
    expect(() => recordDiagnostic({ level: 'warn', source: 'renderer', message: 'rejected' })).not.toThrow();
  });
});
