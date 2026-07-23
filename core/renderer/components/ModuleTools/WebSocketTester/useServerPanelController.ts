import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  appendServerLog,
  buildServerSendParams,
  buildServerStartParams,
  canStartServer,
  clampStressOptions,
  DEFAULT_SERVER_STATUS,
} from './ServerPanel.model';
import type {
  LogItem,
  ServerFormState,
  ServerStatus,
  WsServerBridge,
  WsServerEvent,
} from './ServerPanel.types';

export function useServerPanelController(bridge: WsServerBridge) {
  const [form, setForm] = useState<ServerFormState>({
    host: '0.0.0.0',
    port: '8080',
    path: '/ws',
    tls: false,
    certPem: '',
    keyPem: '',
  });
  const [broadcastText, setBroadcastText] = useState('{"type":"pong"}');
  const [selectedClientId, setSelectedClientId] = useState('broadcast');
  const [stressEnabled, setStressEnabled] = useState(false);
  const [stressIntervalMs, setStressIntervalMs] = useState('1000');
  const [stressPayloadBytes, setStressPayloadBytes] = useState('64');
  const [status, setStatus] = useState<ServerStatus>(DEFAULT_SERVER_STATUS);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const pollTimerRef = useRef<number | null>(null);
  const eventHandlerRef = useRef<unknown>(null);

  const clients = status.clients;
  const running = status.running;
  const startDisabled = useMemo(
    () =>
      !canStartServer({
        apiAvailable: bridge.isAvailable(),
        running,
        port: form.port,
        tls: form.tls,
        certPem: form.certPem,
        keyPem: form.keyPem,
      }),
    [bridge, form.certPem, form.keyPem, form.port, form.tls, running],
  );

  const setFormField = <K extends keyof ServerFormState>(key: K, value: ServerFormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const refreshStatus = useCallback(async () => {
    try {
      const next = await bridge.status();
      if (next) setStatus(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [bridge]);

  const start = async () => {
    setError('');
    if (!bridge.isAvailable()) {
      setError('wsServerStart not available');
      return;
    }
    try {
      await bridge.start(buildServerStartParams(form));
      await refreshStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stop = async () => {
    setError('');
    try {
      await bridge.stop();
      setStressEnabled(false);
      await refreshStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadPem = async (field: 'certPem' | 'keyPem') => {
    try {
      setFormField(field, await bridge.openPem());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const send = async () => {
    setError('');
    if (!broadcastText) return;
    try {
      await bridge.send(buildServerSendParams(selectedClientId, broadcastText));
      await refreshStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const kick = async () => {
    setError('');
    if (!selectedClientId || selectedClientId === 'broadcast') return;
    try {
      await bridge.kick({ clientId: selectedClientId });
      await refreshStatus();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleStress = async () => {
    setError('');
    try {
      if (stressEnabled) {
        await bridge.stressStop();
        setStressEnabled(false);
      } else {
        await bridge.stressStart(clampStressOptions(stressIntervalMs, stressPayloadBytes));
        setStressEnabled(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      await refreshStatus();
    }
  };

  useEffect(() => {
    if (!bridge.isAvailable()) return;
    const handler = (event: WsServerEvent) => {
      if (!event) return;
      if (event.type === 'log') {
        setLogs((previous) => appendServerLog(previous, event.level, event.message));
      }
      if (event.type === 'status') setStatus(event.status);
    };
    eventHandlerRef.current = bridge.onEvent(handler);
    void refreshStatus();
    pollTimerRef.current = window.setInterval(() => void refreshStatus(), 1000);
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
      if (eventHandlerRef.current) bridge.offEvent(eventHandlerRef.current);
      eventHandlerRef.current = null;
    };
  }, [bridge, refreshStatus]);

  return {
    form,
    status,
    clients,
    running,
    error,
    logs,
    broadcastText,
    selectedClientId,
    stressEnabled,
    stressIntervalMs,
    stressPayloadBytes,
    startDisabled,
    setFormField,
    setBroadcastText,
    setSelectedClientId,
    setStressIntervalMs,
    setStressPayloadBytes,
    setLogs,
    start: () => void start(),
    stop: () => void stop(),
    loadCert: () => void loadPem('certPem'),
    loadKey: () => void loadPem('keyPem'),
    send: () => void send(),
    kick: () => void kick(),
    toggleStress: () => void toggleStress(),
  };
}
