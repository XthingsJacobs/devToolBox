import type { LogItem, LogKind, ServerFormState, ServerStatus } from './ServerPanel.types';

export const DEFAULT_SERVER_STATUS: ServerStatus = {
  running: false,
  url: '',
  tls: false,
  clients: [],
  stats: { totalRecv: 0, totalSent: 0 },
};

export function nowText(date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function classifyServerLog(level: LogItem['level'], text: string): LogKind {
  if (level === 'error') return 'error';
  const normalized = text.trim().toLowerCase();
  if (normalized.startsWith('recv')) return 'recv';
  if (normalized.startsWith('send')) return 'send';
  return 'system';
}

export function appendServerLog(
  previous: LogItem[],
  level: LogItem['level'],
  text: string,
  timestamp = nowText(),
  maxItems = 800,
): LogItem[] {
  const next = [...previous, { ts: timestamp, level, kind: classifyServerLog(level, text), text }];
  return next.length > maxItems ? next.slice(next.length - maxItems) : next;
}

export function isValidServerPort(port: string): boolean {
  const parsed = Number(port);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 65535;
}

export function canStartServer({
  apiAvailable,
  running,
  port,
  tls,
  certPem,
  keyPem,
}: {
  apiAvailable: boolean;
  running: boolean;
  port: string;
  tls: boolean;
  certPem: string;
  keyPem: string;
}): boolean {
  if (!apiAvailable || running || !isValidServerPort(port)) return false;
  if (tls && (!certPem.trim() || !keyPem.trim())) return false;
  return true;
}

export function buildServerStartParams(form: ServerFormState): Record<string, unknown> {
  return {
    host: form.host.trim(),
    port: Number(form.port),
    path: form.path.trim() || '/',
    tls: form.tls,
    certPem: form.certPem.trim() || undefined,
    keyPem: form.keyPem.trim() || undefined,
  };
}

export function buildServerSendParams(selectedClientId: string, data: string): Record<string, unknown> {
  if (selectedClientId === 'broadcast') return { broadcast: true, data };
  return { clientId: selectedClientId, data };
}

export function clampStressOptions(
  intervalMs: string,
  payloadBytes: string,
): { intervalMs: number; payloadBytes: number } {
  return {
    intervalMs: Math.max(10, Math.min(60000, Math.floor(Number(intervalMs) || 1000))),
    payloadBytes: Math.max(1, Math.min(65536, Math.floor(Number(payloadBytes) || 64))),
  };
}
