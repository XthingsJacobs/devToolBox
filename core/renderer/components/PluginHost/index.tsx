import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VscChromeClose, VscTerminal, VscTrash } from 'react-icons/vsc';
import styles from './PluginHost.module.css';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { pluginService } from '../../services';
import type { PluginSdkError, PluginSdkRequest, PluginSdkResponse, PluginSdkResult } from '@devtoolbox/core';

type HostSdkResult = PluginSdkResult | { ok: boolean; data?: unknown; error?: PluginSdkError };
type ConsoleEntry = {
  id: number;
  time: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  kind: 'host' | 'sdk' | 'log';
  text: string;
  detail?: string;
};

const MAX_CONSOLE_ENTRIES = 80;

function unsupportedServiceResult(): HostSdkResult {
  return { ok: false, error: { code: 'not_supported', message: 'electronAPI not available' } };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function getMessageOrigin(urlValue: string): string | undefined {
  try {
    const url = new URL(urlValue, window.location.href);
    if (url.protocol === 'devtoolbox-plugin:') return `${url.protocol}//${url.host}`;
    return url.origin === 'null' ? undefined : url.origin;
  } catch {
    return undefined;
  }
}

function asRequestMessage(v: unknown): PluginSdkRequest | null {
  if (!isRecord(v)) return null;
  if (v.type !== 'devtoolbox:sdk:request') return null;
  if (typeof v.requestId !== 'string') return null;
  if (typeof v.method !== 'string') return null;
  const msg = v as PluginSdkRequest;
  return msg;
}

function logToMain(pluginId: string, level: string, message: string, data?: unknown) {
  void pluginService.log(pluginId, { level, message, data });
}

function formatDetail(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parsePluginLog(method: string, params: unknown): { level: ConsoleEntry['level']; text: string; detail?: string } | undefined {
  if (!method.startsWith('log.')) return undefined;
  const values = isRecord(params) ? params : {};
  const rawLevel = method.slice(4);
  const level: ConsoleEntry['level'] =
    rawLevel === 'debug' || rawLevel === 'info' || rawLevel === 'warn' || rawLevel === 'error'
      ? rawLevel
      : 'info';
  const text = typeof values.message === 'string' ? values.message : typeof params === 'string' ? params : '';
  return { level, text: text || '(empty log message)', detail: formatDetail(values.data) };
}

async function callSdk(pluginId: string, method: string, params: unknown): Promise<HostSdkResult> {
  if (
    method === 'log.debug' ||
    method === 'log.info' ||
    method === 'log.warn' ||
    method === 'log.error' ||
    method === 'log.log'
  ) {
    const p = isRecord(params) ? params : {};
    const message = typeof p.message === 'string' ? p.message : typeof params === 'string' ? params : '';
    const data = p.data;
    void pluginService.log(pluginId, { level: method.split('.')[1], message, data });
    return { ok: true, data: true };
  }

  if (method === 'http.request') {
    return (
      pluginService.httpRequest(pluginId, params) ?? {
        ok: false,
        error: { code: 'not_supported', message: 'electronAPI not available' },
      }
    );
  }

  if (method === 'storage.get') {
    const p = isRecord(params) ? params : {};
    return pluginService.storageGet(pluginId, String(p.key ?? '')) ?? unsupportedServiceResult();
  }
  if (method === 'storage.set') {
    const p = isRecord(params) ? params : {};
    return pluginService.storageSet(pluginId, String(p.key ?? ''), p.value) ?? unsupportedServiceResult();
  }
  if (method === 'storage.delete') {
    const p = isRecord(params) ? params : {};
    return pluginService.storageDelete(pluginId, String(p.key ?? '')) ?? unsupportedServiceResult();
  }
  if (method === 'storage.list') {
    const p = isRecord(params) ? params : {};
    return (
      pluginService.storageList(pluginId, typeof p.prefix === 'string' ? p.prefix : undefined) ??
      unsupportedServiceResult()
    );
  }
  if (method === 'storage.clear') return pluginService.storageClear(pluginId) ?? unsupportedServiceResult();

  if (method === 'fs.openFileDialog')
    return pluginService.fsOpenFileDialog(pluginId, params) ?? unsupportedServiceResult();
  if (method === 'fs.saveFileDialog')
    return pluginService.fsSaveFileDialog(pluginId, params) ?? unsupportedServiceResult();
  if (method === 'fs.readFile') {
    const p = isRecord(params) ? params : {};
    return (
      pluginService.fsReadFile(
        pluginId,
        String(p.fileToken ?? ''),
        typeof p.encoding === 'string' ? p.encoding : undefined,
      ) ?? unsupportedServiceResult()
    );
  }
  if (method === 'fs.writeFile') {
    const p = isRecord(params) ? params : {};
    return (
      pluginService.fsWriteFile(
        pluginId,
        String(p.fileToken ?? ''),
        String(p.content ?? ''),
        typeof p.encoding === 'string' ? p.encoding : undefined,
      ) ?? unsupportedServiceResult()
    );
  }

  if (method === 'system.openExternal') {
    const p = isRecord(params) ? params : {};
    return pluginService.systemOpenExternal(pluginId, String(p.url ?? '')) ?? unsupportedServiceResult();
  }
  if (method === 'system.revealPath') {
    const p = isRecord(params) ? params : {};
    return pluginService.systemRevealPath(pluginId, String(p.pathToken ?? '')) ?? unsupportedServiceResult();
  }
  if (method === 'system.openPath') {
    const p = isRecord(params) ? params : {};
    return pluginService.systemOpenPath(pluginId, String(p.pathToken ?? '')) ?? unsupportedServiceResult();
  }
  if (method === 'system.notify')
    return pluginService.systemNotify(pluginId, params) ?? unsupportedServiceResult();
  if (method === 'system.getInfo') return pluginService.systemGetInfo(pluginId) ?? unsupportedServiceResult();
  if (method === 'system.getEnv') {
    const p = isRecord(params) ? params : {};
    const keys = Array.isArray(p.keys) ? p.keys.filter((k): k is string => typeof k === 'string') : [];
    return pluginService.systemGetEnv(pluginId, keys) ?? unsupportedServiceResult();
  }

  return { ok: false, error: { code: 'not_supported', message: `Unknown method: ${method}` } };
}

interface PluginHostProps {
  pluginId: string;
  entryUrl: string;
}

type LoadState = 'loading' | 'ready' | 'timeout' | 'error';

function isMarketplacePluginUrl(urlValue: string): boolean {
  try {
    return new URL(urlValue, window.location.href).protocol === 'devtoolbox-plugin:';
  } catch {
    return false;
  }
}

export default function PluginHost({ pluginId, entryUrl }: PluginHostProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const consoleIdRef = useRef(0);
  const { theme } = useTheme();
  const { locale } = useI18n();
  const readySignalReceivedRef = useRef(false);

  const src = useMemo(() => {
    if (!entryUrl.trim()) return '';
    try {
      const u = new URL(entryUrl, window.location.href);
      u.searchParams.set('theme', theme);
      u.searchParams.set('locale', locale);
      u.searchParams.set('hostOrigin', window.location.origin);
      return u.toString();
    } catch {
      return entryUrl;
    }
  }, [entryUrl, locale, theme]);
  const messageOrigin = useMemo(() => getMessageOrigin(src), [src]);
  const requiresReadySignal = useMemo(() => isMarketplacePluginUrl(src), [src]);
  const copy =
    locale === 'zh-CN'
      ? {
          loading: '正在启动插件...',
          timeoutTitle: '插件启动超时',
          errorTitle: '插件加载失败',
          timeoutDetail: '插件未在预期时间内完成初始化。你可以重新加载该插件。',
          errorDetail: '插件页面无法加载。请检查插件包后重试。',
          reload: '重新加载插件',
          unavailable: '插件不可用。',
        }
      : {
          loading: 'Starting plugin...',
          timeoutTitle: 'Plugin startup timed out',
          errorTitle: 'Plugin failed to load',
          timeoutDetail: 'The plugin did not finish initializing in time. You can reload it and try again.',
          errorDetail: 'The plugin page could not be loaded. Check the plugin package and try again.',
          reload: 'Reload plugin',
          unavailable: 'Plugin not available.',
        };
  const consoleCopy =
    locale === 'zh-CN'
      ? { console: '控制台', clear: '清空', close: '关闭', empty: '暂无运行事件' }
      : { console: 'Console', clear: 'Clear', close: 'Close', empty: 'No runtime events yet' };

  const appendConsole = useCallback((entry: Omit<ConsoleEntry, 'id' | 'time'>) => {
    const next: ConsoleEntry = {
      ...entry,
      id: consoleIdRef.current++,
      time: new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };
    setConsoleEntries((entries) => [...entries.slice(-(MAX_CONSOLE_ENTRIES - 1)), next]);
  }, []);

  const postToPlugin = useCallback(
    (message: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(message, messageOrigin ?? '*');
    },
    [messageOrigin],
  );

  const handleFrameError = useCallback(() => {
    logToMain(pluginId, 'error', 'iframe failed to load', { src });
    appendConsole({ kind: 'host', level: 'error', text: 'iframe failed to load', detail: src });
    setLoadState('error');
  }, [appendConsole, pluginId, src]);

  useEffect(() => {
    readySignalReceivedRef.current = false;
    setLoadState('loading');
  }, [src]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    frame.addEventListener('error', handleFrameError);
    return () => frame.removeEventListener('error', handleFrameError);
  }, [handleFrameError, reloadKey]);

  useEffect(() => {
    if (loadState !== 'loading') return;
    const timer = window.setTimeout(() => {
      logToMain(pluginId, 'warn', 'plugin startup timed out', { src });
      appendConsole({ kind: 'host', level: 'warn', text: 'plugin startup timed out', detail: src });
      setLoadState('timeout');
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [appendConsole, loadState, pluginId, reloadKey, src]);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      const iframeWin = iframeRef.current?.contentWindow;
      if (!iframeWin || event.source !== iframeWin) return;
      if (messageOrigin && event.origin !== messageOrigin) return;

      if (isRecord(event.data) && event.data.type === 'devtoolbox:plugin:ready') {
        postToPlugin({ type: 'devtoolbox:plugin:ready:ack' });
        if (readySignalReceivedRef.current) return;
        readySignalReceivedRef.current = true;
        logToMain(pluginId, 'info', 'ready signal received');
        appendConsole({ kind: 'host', level: 'info', text: 'ready signal received' });
        setLoadState('ready');
        return;
      }

      const req = asRequestMessage(event.data);
      if (!req) return;
      if (req.pluginId && req.pluginId !== pluginId) return;

      const pluginLog = parsePluginLog(req.method, req.params);
      if (pluginLog) appendConsole({ kind: 'log', ...pluginLog });
      else appendConsole({ kind: 'sdk', level: 'debug', text: `${req.method} requested` });

      const result = await callSdk(pluginId, req.method, req.params);
      appendConsole(
        result.ok
          ? { kind: 'sdk', level: 'info', text: `${req.method} ok` }
          : {
              kind: 'sdk',
              level: 'error',
              text: `${req.method} failed: ${result.error?.code ?? 'unknown'}`,
              detail: formatDetail(result.error?.details ?? result.error?.message),
            },
      );
      const res: PluginSdkResponse = result.ok
        ? { type: 'devtoolbox:sdk:response', requestId: req.requestId, ok: true, data: result.data }
        : {
            type: 'devtoolbox:sdk:response',
            requestId: req.requestId,
            ok: false,
            error: result.error ?? { code: 'io_error', message: 'Unknown error' },
          };
      postToPlugin(res);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [appendConsole, messageOrigin, pluginId, postToPlugin]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    postToPlugin({ type: 'devtoolbox:theme', theme });
  }, [loadState, postToPlugin, theme]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    postToPlugin({ type: 'devtoolbox:locale', locale });
  }, [loadState, locale, postToPlugin]);

  const reload = () => {
    readySignalReceivedRef.current = false;
    appendConsole({ kind: 'host', level: 'info', text: 'reload requested' });
    setLoadState('loading');
    setReloadKey((value) => value + 1);
  };

  if (!src) return <div className={styles.empty}>{copy.unavailable}</div>;

  return (
    <div className={styles.wrap}>
      <iframe
        key={`${pluginId}:${reloadKey}`}
        ref={iframeRef}
        className={styles.frame}
        src={src}
        title={pluginId}
        onLoad={() => {
          logToMain(pluginId, 'info', 'iframe loaded');
          appendConsole({ kind: 'host', level: 'info', text: 'iframe loaded', detail: src });
          if (!requiresReadySignal) setLoadState('ready');
        }}
        sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
      />
      {loadState !== 'ready' && (
        <div
          className={`${styles.overlay} ${loadState === 'loading' ? styles.loadingOverlay : styles.failureOverlay}`}
          role={loadState === 'loading' ? 'status' : 'alert'}
          aria-live="polite"
        >
          {loadState === 'loading' ? (
            <div className={styles.loadingContent}>
              <span className={styles.loadingDot} aria-hidden="true" />
              <span>{copy.loading}</span>
            </div>
          ) : (
            <div className={styles.failureCard}>
              <div className={styles.failureTitle}>
                {loadState === 'timeout' ? copy.timeoutTitle : copy.errorTitle}
              </div>
              <div className={styles.failureDetail}>
                {loadState === 'timeout' ? copy.timeoutDetail : copy.errorDetail}
              </div>
              <button type="button" className={styles.reloadButton} onClick={reload}>
                {copy.reload}
              </button>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className={styles.consoleToggle}
        onClick={() => setConsoleOpen((value) => !value)}
        aria-expanded={consoleOpen}
        title={consoleCopy.console}
      >
        <VscTerminal aria-hidden="true" />
        <span>{consoleCopy.console}</span>
        {consoleEntries.length ? <span className={styles.consoleCount}>{consoleEntries.length}</span> : null}
      </button>
      {consoleOpen && (
        <section className={styles.consolePanel} aria-label={consoleCopy.console}>
          <div className={styles.consoleHeader}>
            <div className={styles.consoleTitle}>
              <VscTerminal aria-hidden="true" />
              <span>{consoleCopy.console}</span>
            </div>
            <div className={styles.consoleActions}>
              <button
                type="button"
                onClick={() => setConsoleEntries([])}
                title={consoleCopy.clear}
                aria-label={consoleCopy.clear}
              >
                <VscTrash aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setConsoleOpen(false)}
                title={consoleCopy.close}
                aria-label={consoleCopy.close}
              >
                <VscChromeClose aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className={styles.consoleList}>
            {consoleEntries.length ? (
              consoleEntries.map((entry) => (
                <div key={entry.id} className={`${styles.consoleEntry} ${styles[`console_${entry.level}`]}`}>
                  <span className={styles.consoleTime}>{entry.time}</span>
                  <span className={styles.consoleKind}>{entry.kind}</span>
                  <span className={styles.consoleText}>{entry.text}</span>
                  {entry.detail ? <span className={styles.consoleDetail}>{entry.detail}</span> : null}
                </div>
              ))
            ) : (
              <div className={styles.consoleEmpty}>{consoleCopy.empty}</div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
