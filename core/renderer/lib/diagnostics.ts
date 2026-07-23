import type { RendererDiagnosticEventInput } from '@devtoolbox/core';
import { diagnosticsService } from '../services';

function errorDetails(value: unknown): Record<string, unknown> {
  if (value instanceof Error) {
    const cause = 'cause' in value ? (value as Error & { cause?: unknown }).cause : undefined;
    return { name: value.name, message: value.message, stack: value.stack, cause };
  }
  return { reason: value };
}

function errorMessage(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

export function recordDiagnostic(event: RendererDiagnosticEventInput): void {
  try {
    const request = diagnosticsService.record(event);
    if (request) void request.catch(() => undefined);
  } catch {
    // Diagnostics must never create a second application failure.
  }
}

export function installRendererDiagnostics(): () => void {
  const onError = (event: ErrorEvent) => {
    recordDiagnostic({
      level: 'error',
      source: 'renderer',
      scope: 'window.error',
      message: event.message || errorMessage(event.error, 'Unhandled renderer error'),
      details: {
        ...errorDetails(event.error),
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
      },
    });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    recordDiagnostic({
      level: 'error',
      source: 'renderer',
      scope: 'unhandled-rejection',
      message: errorMessage(event.reason, 'Unhandled renderer promise rejection'),
      details: errorDetails(event.reason),
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
