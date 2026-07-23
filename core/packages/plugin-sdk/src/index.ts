export const SDK_METHODS = [
  'http.request',
  'storage.get',
  'storage.set',
  'storage.delete',
  'storage.list',
  'storage.clear',
  'fs.openFileDialog',
  'fs.saveFileDialog',
  'fs.readFile',
  'fs.writeFile',
  'system.openExternal',
  'system.revealPath',
  'system.openPath',
  'system.notify',
  'system.getInfo',
  'system.getEnv',
  'log.debug',
  'log.info',
  'log.warn',
  'log.error',
  'log.log',
] as const;

export type SdkMethod = (typeof SDK_METHODS)[number];
export type SdkError = { code: string; message: string; details?: unknown };
export type SdkResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: SdkError };
export type SdkResponse =
  | { type: 'devtoolbox:sdk:response'; requestId: string; ok: true; data?: unknown }
  | { type: 'devtoolbox:sdk:response'; requestId: string; ok: false; error: SdkError };

type PendingRequest = {
  resolve: (result: SdkResult<unknown>) => void;
  timer: number;
};

const pending = new Map<string, PendingRequest>();
const query = new URLSearchParams(window.location.search);
const configuredHostOrigin = query.get('hostOrigin');
const hostOrigin = configuredHostOrigin && configuredHostOrigin !== 'null' ? configuredHostOrigin : undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseResponse(value: unknown): SdkResponse | undefined {
  if (!isRecord(value) || value.type !== 'devtoolbox:sdk:response') return undefined;
  if (typeof value.requestId !== 'string' || typeof value.ok !== 'boolean') return undefined;
  if (value.ok) {
    return { type: 'devtoolbox:sdk:response', requestId: value.requestId, ok: true, data: value.data };
  }
  if (
    !isRecord(value.error) ||
    typeof value.error.code !== 'string' ||
    typeof value.error.message !== 'string'
  ) {
    return undefined;
  }
  return {
    type: 'devtoolbox:sdk:response',
    requestId: value.requestId,
    ok: false,
    error: {
      code: value.error.code,
      message: value.error.message,
      details: value.error.details,
    },
  };
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  if (hostOrigin && event.origin !== hostOrigin) return;
  const message = parseResponse(event.data);
  if (!message) return;
  const request = pending.get(message.requestId);
  if (!request) return;
  pending.delete(message.requestId);
  window.clearTimeout(request.timer);
  if (message.ok) request.resolve({ ok: true, data: message.data });
  else request.resolve({ ok: false, error: message.error });
});

function requestId(): string {
  if (typeof window.crypto?.randomUUID === 'function') return window.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function callSdk<T = unknown>(
  method: SdkMethod,
  params?: unknown,
  timeoutMs = 15_000,
): Promise<SdkResult<T>> {
  const id = requestId();
  window.parent.postMessage(
    { type: 'devtoolbox:sdk:request', requestId: id, method, params },
    hostOrigin ?? '*',
  );

  return new Promise((resolve) => {
    const timer = window.setTimeout(
      () => {
        if (!pending.delete(id)) return;
        resolve({ ok: false, error: { code: 'timeout', message: 'SDK request timeout' } });
      },
      Math.max(1, Math.min(60_000, timeoutMs)),
    );
    pending.set(id, { resolve: (result) => resolve(result as SdkResult<T>), timer });
  });
}

export type HttpRequestParams = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  responseType?: 'text' | 'json' | 'arrayBuffer';
};

export type HttpResponse<T = unknown> = {
  status: number;
  headers: Record<string, string>;
  data: T;
};

export const sdk = {
  http: {
    request: <T = unknown>(params: HttpRequestParams) => callSdk<HttpResponse<T>>('http.request', params),
  },
  system: {
    getInfo: () => callSdk('system.getInfo'),
    notify: (params: unknown) => callSdk('system.notify', params),
  },
  storage: {
    get: <T = unknown>(key: string) => callSdk<T>('storage.get', { key }),
    set: (key: string, value: unknown) => callSdk('storage.set', { key, value }),
    delete: (key: string) => callSdk('storage.delete', { key }),
    list: (prefix?: string) => callSdk<string[]>('storage.list', { prefix }),
    clear: () => callSdk('storage.clear'),
  },
  log: {
    debug: (message: string, data?: unknown) => callSdk('log.debug', { message, data }),
    info: (message: string, data?: unknown) => callSdk('log.info', { message, data }),
    warn: (message: string, data?: unknown) => callSdk('log.warn', { message, data }),
    error: (message: string, data?: unknown) => callSdk('log.error', { message, data }),
  },
};
