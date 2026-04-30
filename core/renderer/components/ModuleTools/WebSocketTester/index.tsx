import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './WebSocketTester.module.css';
import { useI18n, getModuleLocale } from '../../../i18n';
import {
  SearchBar,
  ToolButton,
  ToolField,
  ToolInput,
  ToolSection,
  useSplitPane,
  useTextSearch,
} from '@@components';
import ts from '@@components/TextSearch/TextSearch.module.css';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { VscDebugDisconnect, VscSend, VscTerminal } from 'react-icons/vsc';

type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type LogType = 'send' | 'recv' | 'info' | 'error';

interface LogItem {
  ts: number;
  type: LogType;
  text: string;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const msPart = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${msPart}`;
}

function isValidWsUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === 'ws:' || u.protocol === 'wss:';
  } catch {
    return false;
  }
}

function parseProtocols(input: string): string[] | undefined {
  const list = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export default function WebSocketTester() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'WebSocketTester');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);

  const [url, setUrl] = useState('ws://localhost:8080');
  const [protocols, setProtocols] = useState('');
  const [status, setStatus] = useState<ConnStatus>('disconnected');
  const [autoScroll, setAutoScroll] = useState(true);

  const [message, setMessage] = useState('');
  const [sendJson, setSendJson] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLTextAreaElement>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);

  const { splitPercent, containerRef, handleMouseDown } = useSplitPane(45);

  const pushLog = useCallback((type: LogType, text: string) => {
    setLogs((prev) => [...prev, { ts: Date.now(), type, text }]);
  }, []);

  const cleanup = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
    }
    wsRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      ws.close(1000, 'client close');
    } catch {
      try {
        ws.close();
      } catch {
        void 0;
      }
    }
  }, []);

  const connect = useCallback(() => {
    const target = url.trim();
    if (!isValidWsUrl(target)) {
      setStatus('error');
      pushLog('error', mt('invalidUrl'));
      return;
    }

    cleanup();
    setStatus('connecting');
    pushLog('info', `${mt('connect')}: ${target}`);

    const protos = parseProtocols(protocols.trim());
    const ws = new WebSocket(target, protos);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      pushLog('info', mt('statusConnected'));
    };

    ws.onmessage = async (ev) => {
      const data = ev.data;
      if (typeof data === 'string') {
        pushLog('recv', data);
        return;
      }
      if (data instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(new Uint8Array(data));
        pushLog('recv', text);
        return;
      }
      if (data instanceof Blob) {
        const text = await data.text().catch(() => '');
        pushLog('recv', text || '[blob]');
        return;
      }
      pushLog('recv', String(data));
    };

    ws.onerror = () => {
      setStatus('error');
      pushLog('error', mt('statusError'));
    };

    ws.onclose = (ev) => {
      setStatus('disconnected');
      pushLog('info', `close code=${ev.code} reason=${ev.reason || '-'}`);
      cleanup();
    };
  }, [cleanup, mt, protocols, pushLog, url]);

  useEffect(() => {
    return () => {
      disconnect();
      cleanup();
    };
  }, [cleanup, disconnect]);

  const parsedJson = useMemo(() => {
    if (!sendJson) return null;
    const raw = message.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }, [message, sendJson]);

  const formattedJson = useMemo(() => {
    if (!parsedJson) return null;
    try {
      return JSON.stringify(parsedJson, null, 2);
    } catch {
      return null;
    }
  }, [parsedJson]);

  const highlightedJson = useMemo(() => {
    if (!formattedJson) return null;
    try {
      return hljs.highlight(formattedJson, { language: 'json' }).value;
    } catch {
      return null;
    }
  }, [formattedJson]);

  const logText = useMemo(() => {
    return logs.map((l) => `[${formatTime(l.ts)}] ${l.type.toUpperCase()} ${l.text}`).join('\n');
  }, [logs]);

  const search = useTextSearch(logText, logRef, ts.highlightMark, ts.highlightMarkActive);

  useEffect(() => {
    if (!autoScroll) return;
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logText, autoScroll]);

  const handleSend = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const text = message.trim();
    if (!text) {
      pushLog('error', mt('emptyMessage'));
      return;
    }

    if (sendJson) {
      try {
        const obj = JSON.parse(text);
        const payload = JSON.stringify(obj);
        ws.send(payload);
        pushLog('send', payload);
        return;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        pushLog('error', msg);
        return;
      }
    }

    ws.send(text);
    pushLog('send', text);
  }, [message, mt, pushLog, sendJson]);

  const handleFormatJson = useCallback(() => {
    const raw = message.trim();
    if (!raw) return;
    try {
      const obj = JSON.parse(raw);
      setMessage(JSON.stringify(obj, null, 2));
    } catch {
      pushLog('error', mt('invalidJson'));
    }
  }, [message, mt, pushLog]);

  const handleClear = () => setLogs([]);

  const handleCopy = () => {
    if (!logText) return;
    void navigator.clipboard.writeText(logText);
  };

  const statusLabel = useMemo(() => {
    if (status === 'connected') return mt('statusConnected');
    if (status === 'connecting') return mt('statusConnecting');
    if (status === 'error') return mt('statusError');
    return mt('statusDisconnected');
  }, [mt, status]);

  return (
    <div className={styles.container}>
      <div className={styles.connectionWrap}>
        <ToolSection
          title={mt('connection')}
          icon={<VscDebugDisconnect />}
          actions={
            <>
              <span className={styles.statusPill}>
                <span className={`${styles.dot} ${styles[`dot_${status}`]}`} />
                {mt('status')}: {statusLabel}
              </span>
              {status === 'connected' ? (
                <ToolButton onClick={disconnect}>{mt('disconnect')}</ToolButton>
              ) : (
                <ToolButton variant="primary" onClick={connect} disabled={status === 'connecting'}>
                  {mt('connect')}
                </ToolButton>
              )}
            </>
          }
        >
          <div className={styles.connGrid}>
            <ToolField label={mt('url')}>
              <ToolInput
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={mt('urlPlaceholder')}
                spellCheck={false}
                disabled={status === 'connecting' || status === 'connected'}
              />
            </ToolField>
            <ToolField label={mt('protocols')}>
              <ToolInput
                value={protocols}
                onChange={(e) => setProtocols(e.target.value)}
                placeholder={mt('protocolsPlaceholder')}
                spellCheck={false}
                disabled={status === 'connecting' || status === 'connected'}
              />
            </ToolField>
          </div>
        </ToolSection>
      </div>

      <div className={styles.main}>
        <div className={styles.splitContainer} ref={containerRef}>
          <div className={styles.pane} style={{ width: `${splitPercent}%` }}>
            <ToolSection
              fill
              bodyVariant="noPad"
              title={mt('message')}
              icon={<VscSend />}
              actions={
                <div className={styles.actionsRow}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={sendJson}
                      onChange={(e) => setSendJson(e.target.checked)}
                    />
                    <span>{mt('sendJson')}</span>
                  </label>
                  <ToolButton onClick={handleFormatJson} disabled={!sendJson || !message.trim()}>
                    {mt('format')}
                  </ToolButton>
                  <ToolButton variant="primary" onClick={handleSend} disabled={status !== 'connected'}>
                    {mt('send')}
                  </ToolButton>
                </div>
              }
            >
              <div className={styles.messageInputWrap}>
                <div className={styles.messageContent}>
                  <textarea
                    className={styles.messageTextarea}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={mt('messagePlaceholder')}
                    spellCheck={false}
                  />
                  {sendJson && highlightedJson && (
                    <div className={styles.jsonPreviewWrap}>
                      <pre className={styles.jsonPreview}>
                        <code
                          className="hljs language-json"
                          dangerouslySetInnerHTML={{ __html: highlightedJson }}
                        />
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </ToolSection>
          </div>

          <div className={styles.divider} onMouseDown={handleMouseDown} />

          <div className={styles.pane} style={{ width: `${100 - splitPercent}%` }}>
            <ToolSection
              fill
              bodyVariant="noPad"
              title={mt('log')}
              icon={<VscTerminal />}
              actions={
                <div className={styles.actionsRow}>
                  <ToolButton onClick={handleCopy} disabled={!logText}>
                    {mt('copy')}
                  </ToolButton>
                  <ToolButton onClick={handleClear} disabled={!logText}>
                    {mt('clear')}
                  </ToolButton>
                </div>
              }
            >
              <div className={styles.logWrap}>
                {search.visible && <SearchBar search={search} />}
                {search.visible && search.highlightContent && (
                  <div ref={search.overlayRef} className={ts.highlightOverlay}>
                    {search.highlightContent}
                  </div>
                )}
                <textarea
                  ref={logRef}
                  className={`${styles.logTextarea}${search.isTransparent ? ` ${ts.textareaTransparent}` : ''}`}
                  value={logText}
                  readOnly
                  spellCheck={false}
                  onKeyDown={search.handleKeyDown}
                />
              </div>

              <div className={styles.bottomBar}>
                <span className={styles.statusText}>
                  {logs.length} {mt('lines')}
                </span>
                <div className={styles.bottomRight}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={autoScroll}
                      onChange={(e) => setAutoScroll(e.target.checked)}
                    />
                    <span>{mt('autoScroll')}</span>
                  </label>
                </div>
              </div>
            </ToolSection>
          </div>
        </div>
      </div>
    </div>
  );
}
