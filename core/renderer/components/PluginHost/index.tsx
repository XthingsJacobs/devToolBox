import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './PluginHost.module.css';

type RequestMessage = {
  type: 'devtoolbox:sdk:request';
  requestId: string;
  pluginId?: string;
  method: string;
  params?: unknown;
};

type ResponseMessage =
  | { type: 'devtoolbox:sdk:response'; requestId: string; ok: true; data?: unknown }
  | { type: 'devtoolbox:sdk:response'; requestId: string; ok: false; error: { code: string; message: string; details?: unknown } };

type SdkError = { code: string; message: string; details?: unknown };
type SdkResult = { ok: boolean; data?: unknown; error?: SdkError };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asRequestMessage(v: unknown): RequestMessage | null {
  if (!isRecord(v)) return null;
  if (v.type !== 'devtoolbox:sdk:request') return null;
  if (typeof v.requestId !== 'string') return null;
  if (typeof v.method !== 'string') return null;
  const msg = v as RequestMessage;
  return msg;
}

async function callSdk(pluginId: string, method: string, params: unknown): Promise<SdkResult> {
  if (method === 'log.debug' || method === 'log.info' || method === 'log.warn' || method === 'log.error' || method === 'log.log') {
    const p = isRecord(params) ? params : {};
    const message = typeof p.message === 'string' ? p.message : typeof params === 'string' ? params : '';
    const data = p.data;
    const api = window.electronAPI;
    if (api?.pluginLog) void api.pluginLog(pluginId, { level: method.split('.')[1], message, data });
    return { ok: true, data: true };
  }

  const api = window.electronAPI;
  if (!api) return { ok: false, error: { code: 'not_supported', message: 'electronAPI not available' } };

  if (method === 'http.request') return api.pluginHttpRequest(pluginId, params);

  if (method === 'storage.get') {
    const p = isRecord(params) ? params : {};
    return api.pluginStorageGet(pluginId, String(p.key ?? ''));
  }
  if (method === 'storage.set') {
    const p = isRecord(params) ? params : {};
    return api.pluginStorageSet(pluginId, String(p.key ?? ''), p.value);
  }
  if (method === 'storage.delete') {
    const p = isRecord(params) ? params : {};
    return api.pluginStorageDelete(pluginId, String(p.key ?? ''));
  }
  if (method === 'storage.list') {
    const p = isRecord(params) ? params : {};
    return api.pluginStorageList(pluginId, typeof p.prefix === 'string' ? p.prefix : undefined);
  }
  if (method === 'storage.clear') return api.pluginStorageClear(pluginId);

  if (method === 'fs.openFileDialog') return api.pluginFsOpenFileDialog(pluginId, params);
  if (method === 'fs.saveFileDialog') return api.pluginFsSaveFileDialog(pluginId, params);
  if (method === 'fs.readFile') {
    const p = isRecord(params) ? params : {};
    return api.pluginFsReadFile(pluginId, String(p.fileToken ?? ''), typeof p.encoding === 'string' ? p.encoding : undefined);
  }
  if (method === 'fs.writeFile') {
    const p = isRecord(params) ? params : {};
    return api.pluginFsWriteFile(
      pluginId,
      String(p.fileToken ?? ''),
      String(p.content ?? ''),
      typeof p.encoding === 'string' ? p.encoding : undefined,
    );
  }

  if (method === 'system.openExternal') {
    const p = isRecord(params) ? params : {};
    return api.pluginSystemOpenExternal(pluginId, String(p.url ?? ''));
  }
  if (method === 'system.revealPath') {
    const p = isRecord(params) ? params : {};
    return api.pluginSystemRevealPath(pluginId, String(p.pathToken ?? ''));
  }
  if (method === 'system.openPath') {
    const p = isRecord(params) ? params : {};
    return api.pluginSystemOpenPath(pluginId, String(p.pathToken ?? ''));
  }
  if (method === 'system.notify') return api.pluginSystemNotify(pluginId, params);
  if (method === 'system.getInfo') return api.pluginSystemGetInfo(pluginId);
  if (method === 'system.getEnv') {
    const p = isRecord(params) ? params : {};
    const keys = Array.isArray(p.keys) ? p.keys.filter((k): k is string => typeof k === 'string') : [];
    return api.pluginSystemGetEnv(pluginId, keys);
  }

  return { ok: false, error: { code: 'not_supported', message: `Unknown method: ${method}` } };
}

interface PluginHostProps {
  pluginId: string;
  entryUrl: string;
}

export default function PluginHost({ pluginId, entryUrl }: PluginHostProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);

  const src = useMemo(() => entryUrl, [entryUrl]);

  useEffect(() => {
    setReady(false);
  }, [src]);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const iframeWin = iframeRef.current?.contentWindow;
      if (!iframeWin || event.source !== iframeWin) return;

      const req = asRequestMessage(event.data);
      if (!req) return;
      if (req.pluginId && req.pluginId !== pluginId) return;

      const result = await callSdk(pluginId, req.method, req.params);
      const res: ResponseMessage = result.ok
        ? { type: 'devtoolbox:sdk:response', requestId: req.requestId, ok: true, data: result.data }
        : {
            type: 'devtoolbox:sdk:response',
            requestId: req.requestId,
            ok: false,
            error: result.error ?? { code: 'io_error', message: 'Unknown error' },
          };
      iframeWin.postMessage(res, '*');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [pluginId]);

  if (!src) return <div className={styles.empty}>Plugin not available.</div>;

  return (
    <div className={styles.wrap}>
      <iframe
        ref={iframeRef}
        className={styles.frame}
        src={src}
        title={pluginId}
        onLoad={() => setReady(true)}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-same-origin"
      />
      {!ready && <div className={styles.empty}>Loading...</div>}
    </div>
  );
}
