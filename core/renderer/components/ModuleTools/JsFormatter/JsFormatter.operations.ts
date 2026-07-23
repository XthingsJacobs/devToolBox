type ObfuscateWorkerResponse = { ok: true; result: string } | { ok: false; error: string };

function abortError(): DOMException {
  return new DOMException('Operation cancelled', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export async function beautifyJavascript(input: string): Promise<string> {
  const prettier = await import('prettier/standalone');
  const parserBabel = await import('prettier/plugins/babel');
  const estree = await import('prettier/plugins/estree');

  return prettier.format(input, {
    parser: 'babel',
    plugins: [parserBabel.default, estree.default],
    semi: true,
    singleQuote: false,
    tabWidth: 2,
  });
}

export async function minifyJavascript(input: string): Promise<string> {
  const { minify } = await import('terser');
  const result = await minify(input, { compress: true, mangle: false });
  return result.code || '';
}

export async function evalPackJavascript(input: string): Promise<string> {
  const { minify } = await import('terser');
  const result = await minify(input, {
    compress: true,
    mangle: { toplevel: true },
    output: { beautify: false },
  });
  const code = result.code || '';
  return `eval(${JSON.stringify(code)});`;
}

export async function highCompressJavascript(input: string): Promise<string> {
  const { minify } = await import('terser');
  const result = await minify(input, {
    compress: { passes: 3, pure_getters: true, unsafe: true, unsafe_math: true },
    mangle: { toplevel: true },
    output: { beautify: false },
  });
  return result.code || '';
}

export function obfuscateInWorker(input: string, signal: AbortSignal): Promise<string> {
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./js-obfuscate.worker.ts', import.meta.url), { type: 'module' });
    let settled = false;

    const cleanup = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const onAbort = () => settle(() => reject(abortError()));

    worker.onmessage = (event: MessageEvent<ObfuscateWorkerResponse>) => {
      const response = event.data;
      if (response.ok) settle(() => resolve(response.result));
      else settle(() => reject(new Error(response.error)));
    };
    worker.onerror = (event) => {
      settle(() => reject(new Error(event.message || 'Obfuscation worker failed')));
    };

    signal.addEventListener('abort', onAbort, { once: true });
    const timeout = window.setTimeout(() => settle(() => reject(new Error('Obfuscation timed out'))), 60_000);

    if (signal.aborted) {
      onAbort();
      return;
    }
    worker.postMessage({ input });
  });
}
