import { BrowserWindow, ipcMain } from 'electron';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';

type ClientInfo = {
  id: string;
  remote: string;
  connectedAt: string;
  recvCount: number;
  sentCount: number;
};

type Status = {
  running: boolean;
  url: string;
  tls: boolean;
  clients: ClientInfo[];
  stats: { totalRecv: number; totalSent: number };
};

type Event =
  | { type: 'log'; level: 'info' | 'error'; message: string }
  | { type: 'status'; status: Status };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function truncateText(s: string, maxLen = 800): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '…';
}

function isProbablyUtf8Text(s: string): boolean {
  if (!s) return true;
  if (s.includes('\uFFFD')) return false;
  let ctrl = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    const isOk = c === 9 || c === 10 || c === 13 || c >= 32;
    if (!isOk) ctrl += 1;
  }
  return ctrl <= Math.max(1, Math.floor(s.length * 0.02));
}

function rawDataToBuffer(data: unknown): Buffer | null {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) {
    const bufs = data.filter((x): x is Buffer => Buffer.isBuffer(x));
    if (bufs.length === data.length) return Buffer.concat(bufs);
  }
  return null;
}

function formatWsData(data: unknown): string {
  if (typeof data === 'string') return truncateText(data);
  const buf = rawDataToBuffer(data);
  if (!buf) return '[binary]';
  const text = buf.toString('utf8');
  if (isProbablyUtf8Text(text)) return truncateText(text);
  return `base64:${truncateText(buf.toString('base64'), 800)} (bytes=${buf.length})`;
}

function sendEvent(ev: Event): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    try {
      w.webContents.send('wsServer:event', ev);
    } catch {
      void 0;
    }
  });
}

function log(level: 'info' | 'error', message: string): void {
  sendEvent({ type: 'log', level, message });
}

function buildStatus(
  running: boolean,
  url: string,
  tls: boolean,
  clients: Map<string, { ws: WebSocket; info: ClientInfo }>,
  totalRecv: number,
  totalSent: number,
): Status {
  return {
    running,
    url,
    tls,
    clients: Array.from(clients.values()).map((c) => c.info),
    stats: { totalRecv, totalSent },
  };
}

function normalizePath(p: string): string {
  const v = p.trim();
  if (!v) return '/';
  return v.startsWith('/') ? v : `/${v}`;
}

export function register(): void {
  let server: http.Server | https.Server | null = null;
  let wss: WebSocketServer | null = null;
  let currentUrl = '';
  let currentTls = false;
  let totalRecv = 0;
  let totalSent = 0;
  let stressTimer: NodeJS.Timeout | null = null;

  const clients = new Map<string, { ws: WebSocket; info: ClientInfo }>();

  const publishStatus = () => {
    sendEvent({ type: 'status', status: buildStatus(Boolean(server && wss), currentUrl, currentTls, clients, totalRecv, totalSent) });
  };

  const stop = async () => {
    if (stressTimer) {
      try {
        clearInterval(stressTimer);
      } catch {
        void 0;
      }
      stressTimer = null;
    }

    for (const c of clients.values()) {
      try {
        c.ws.close(1000, 'server stop');
      } catch {
        void 0;
      }
    }
    clients.clear();

    if (wss) {
      try {
        await new Promise<void>((resolve) => wss?.close(() => resolve()));
      } catch {
        void 0;
      }
      wss = null;
    }

    if (server) {
      try {
        await new Promise<void>((resolve) => server?.close(() => resolve()));
      } catch {
        void 0;
      }
      server = null;
    }

    currentUrl = '';
    currentTls = false;
    totalRecv = 0;
    totalSent = 0;
    publishStatus();
  };

  ipcMain.handle('wsServer:start', async (_event, params: unknown) => {
    const p = isRecord(params) ? params : {};
    const host = asString(p.host, '0.0.0.0').trim() || '0.0.0.0';
    const port = Math.floor(asNumber(p.port, 0));
    const tls = Boolean(p.tls);
    const path = normalizePath(asString(p.path, '/ws'));
    const certPem = asString(p.certPem).trim();
    const keyPem = asString(p.keyPem).trim();

    if (!port || port < 1 || port > 65535) throw new Error('Invalid port');
    if (tls && (!certPem || !keyPem)) throw new Error('Missing cert/key');

    await stop();

    currentTls = tls;
    currentUrl = `${tls ? 'wss' : 'ws'}://${host}:${port}${path}`;

    log('info', `start: ${currentUrl}`);

    server = tls ? https.createServer({ cert: certPem, key: keyPem }) : http.createServer();
    wss = new WebSocketServer({ server, path, maxPayload: 4 * 1024 * 1024 });

    wss.on('connection', (ws, req) => {
      const id = crypto.randomBytes(8).toString('hex');
      const remote = asString(req.socket.remoteAddress, '-') + ':' + String(req.socket.remotePort ?? '');
      const info: ClientInfo = { id, remote, connectedAt: nowIso(), recvCount: 0, sentCount: 0 };
      clients.set(id, { ws, info });
      log('info', `client:connected ${remote} (${id})`);
      publishStatus();

      ws.on('message', (data) => {
        info.recvCount += 1;
        totalRecv += 1;
        const text = formatWsData(data);
        log('info', `recv (${id}): ${text}`);
        publishStatus();
      });
      ws.on('close', (code, reason) => {
        clients.delete(id);
        log('info', `client:closed ${remote} (${id}) code=${code} reason=${reason.toString() || '-'}`);
        publishStatus();
      });
      ws.on('error', (err) => {
        log('error', `client:error ${remote} (${id}) ${err instanceof Error ? err.message : String(err)}`);
      });
    });

    await new Promise<void>((resolve, reject) => {
      server?.once('error', reject);
      server?.listen(port, host, () => resolve());
    });

    publishStatus();
    return buildStatus(Boolean(server && wss), currentUrl, currentTls, clients, totalRecv, totalSent);
  });

  ipcMain.handle('wsServer:stop', async () => {
    await stop();
    log('info', 'stop');
    return buildStatus(false, '', false, clients, totalRecv, totalSent);
  });

  ipcMain.handle('wsServer:status', () => {
    return buildStatus(Boolean(server && wss), currentUrl, currentTls, clients, totalRecv, totalSent);
  });

  ipcMain.handle('wsServer:send', (_event, params: unknown) => {
    const p = isRecord(params) ? params : {};
    const data = asString(p.data).trim();
    if (!data) throw new Error('Missing data');
    const broadcast = Boolean(p.broadcast);
    const clientId = asString(p.clientId).trim();

    const sendOne = (id: string, ws: WebSocket, info: ClientInfo) => {
      ws.send(data);
      info.sentCount += 1;
      totalSent += 1;
      log('info', `send (${id}): ${data}`);
    };

    if (broadcast) {
      for (const c of clients.values()) {
        sendOne(c.info.id, c.ws, c.info);
      }
    } else {
      const c = clients.get(clientId);
      if (!c) throw new Error('Client not found');
      sendOne(c.info.id, c.ws, c.info);
    }
    publishStatus();
    return true;
  });

  ipcMain.handle('wsServer:kick', (_event, params: unknown) => {
    const p = isRecord(params) ? params : {};
    const clientId = asString(p.clientId).trim();
    const c = clients.get(clientId);
    if (!c) throw new Error('Client not found');
    try {
      c.ws.close(1000, 'kicked');
    } catch {
      void 0;
    }
    return true;
  });

  ipcMain.handle('wsServer:stressStart', (_event, params: unknown) => {
    const p = isRecord(params) ? params : {};
    const intervalMs = Math.max(10, Math.min(60000, Math.floor(asNumber(p.intervalMs, 1000))));
    const payloadBytes = Math.max(1, Math.min(65536, Math.floor(asNumber(p.payloadBytes, 64))));
    if (!server || !wss) throw new Error('Server not running');

    if (stressTimer) {
      try {
        clearInterval(stressTimer);
      } catch {
        void 0;
      }
      stressTimer = null;
    }

    const payload = Buffer.alloc(payloadBytes, 'a');
    stressTimer = setInterval(() => {
      for (const c of clients.values()) {
        try {
          c.ws.send(payload);
          c.info.sentCount += 1;
          totalSent += 1;
        } catch {
          void 0;
        }
      }
      publishStatus();
    }, intervalMs);

    log('info', `stress:start intervalMs=${intervalMs} payloadBytes=${payloadBytes}`);
    return true;
  });

  ipcMain.handle('wsServer:stressStop', () => {
    if (stressTimer) {
      try {
        clearInterval(stressTimer);
      } catch {
        void 0;
      }
      stressTimer = null;
    }
    log('info', 'stress:stop');
    return true;
  });

  ipcMain.on('wsServer:cleanup', () => {
    void stop();
  });
}
