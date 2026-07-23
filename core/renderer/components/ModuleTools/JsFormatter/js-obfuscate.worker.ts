interface ObfuscateRequest {
  input: string;
}

type ObfuscateResponse = { ok: true; result: string } | { ok: false; error: string };

interface WorkerScope {
  onmessage: ((event: MessageEvent<ObfuscateRequest>) => void) | null;
  postMessage(message: ObfuscateResponse): void;
}

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = async (event) => {
  try {
    // The upstream browser bundle assigns to a pre-existing `chance` global in strict module workers.
    if (!Object.prototype.hasOwnProperty.call(globalThis, 'chance')) {
      Object.defineProperty(globalThis, 'chance', { configurable: true, writable: true, value: undefined });
    }
    const { obfuscateJavaScript } = await import('./js-obfuscator-engine');
    workerScope.postMessage({ ok: true, result: obfuscateJavaScript(event.data.input) });
  } catch (error) {
    workerScope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
