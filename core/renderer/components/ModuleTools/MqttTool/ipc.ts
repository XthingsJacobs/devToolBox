import { BrowserWindow, ipcMain } from 'electron';
import type { IClientOptions, IPublishPacket, MqttClient } from 'mqtt';
import dns from 'node:dns/promises';
import dnsCb from 'node:dns';

type MqttConnParams = {
  id: string;
  protocol: 'mqtt://' | 'mqtts://' | 'ws://' | 'wss://';
  host: string;
  port: number;
  path?: string;
  clientId: string;
  username?: string;
  password?: string;
  mqttVersion?: '3.1' | '3.1.1' | '5.0';
  connectTimeout?: number;
  keepAlive?: number;
  autoReconnect?: boolean;
  reconnectPeriod?: number;
  cleanStart?: boolean;
  sessionExpiry?: number;
  lastWillTopic?: string;
  lastWillQos?: 0 | 1 | 2;
  lastWillRetain?: boolean;
  lastWillMessage?: string;
  sslSecure?: boolean;
  alpn?: string;
  caDataB64?: string;
  clientCertDataB64?: string;
  clientKeyDataB64?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function err(code: string, message: string, details?: unknown) {
  return { ok: false, error: { code, message, details } };
}

function ok(data?: unknown) {
  return { ok: true, data };
}

function isDebugEnabled(): boolean {
  const vRaw = process.env.DEVTOOLBOX_DEBUG;
  if (vRaw === undefined || vRaw === null || String(vRaw).trim() === '') return true;
  const v = String(vRaw).trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return true;
}

function timeNow(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function log(message: string, extra?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  const prefix = `[${timeNow()}][mqtt] ${message}`;
  if (extra) console.log(prefix, extra);
  else console.log(prefix);
}

function bufLen(v: unknown): number {
  if (Buffer.isBuffer(v)) return v.length;
  if (Array.isArray(v) && v.every((x) => Buffer.isBuffer(x))) return v.reduce((n, b) => n + b.length, 0);
  return 0;
}

function buildUrl(p: MqttConnParams): string {
  if (p.protocol === 'ws://' || p.protocol === 'wss://') {
    const rawPath = typeof p.path === 'string' ? p.path.trim() : '';
    const path = rawPath ? (rawPath.startsWith('/') ? rawPath : `/${rawPath}`) : '/mqtt';
    return `${p.protocol}${p.host}:${p.port}${path}`;
  }
  return `${p.protocol}${p.host}:${p.port}`;
}

function parseParams(params: unknown): { ok: true; data: MqttConnParams } | { ok: false; error: string } {
  const p = isRecord(params) ? params : {};
  const id = asString(p.id).trim() || 'default';
  const protocol = asString(p.protocol).trim() as MqttConnParams['protocol'];
  const host = asString(p.host).trim();
  const port = asNumber(p.port, 0);
  const clientId = asString(p.clientId).trim();
  if (!id || !protocol || !host || !port || !clientId) return { ok: false, error: 'invalid mqtt connect params' };
  const data: MqttConnParams = { id, protocol, host, port, clientId };
  if (typeof p.path === 'string') data.path = p.path;
  if (typeof p.username === 'string') data.username = p.username;
  if (typeof p.password === 'string') data.password = p.password;
  if (typeof p.mqttVersion === 'string') data.mqttVersion = p.mqttVersion as MqttConnParams['mqttVersion'];
  if (typeof p.connectTimeout === 'number') data.connectTimeout = p.connectTimeout;
  if (typeof p.keepAlive === 'number') data.keepAlive = p.keepAlive;
  if (typeof p.autoReconnect === 'boolean') data.autoReconnect = p.autoReconnect;
  if (typeof p.reconnectPeriod === 'number') data.reconnectPeriod = p.reconnectPeriod;
  if (typeof p.cleanStart === 'boolean') data.cleanStart = p.cleanStart;
  if (typeof p.sessionExpiry === 'number') data.sessionExpiry = p.sessionExpiry;
  if (typeof p.lastWillTopic === 'string') data.lastWillTopic = p.lastWillTopic;
  if (typeof p.lastWillQos === 'number') data.lastWillQos = p.lastWillQos as 0 | 1 | 2;
  if (typeof p.lastWillRetain === 'boolean') data.lastWillRetain = p.lastWillRetain;
  if (typeof p.lastWillMessage === 'string') data.lastWillMessage = p.lastWillMessage;
  if (typeof p.sslSecure === 'boolean') data.sslSecure = p.sslSecure;
  if (typeof p.alpn === 'string') data.alpn = p.alpn;
  if (typeof p.caDataB64 === 'string') data.caDataB64 = p.caDataB64;
  if (typeof p.clientCertDataB64 === 'string') data.clientCertDataB64 = p.clientCertDataB64;
  if (typeof p.clientKeyDataB64 === 'string') data.clientKeyDataB64 = p.clientKeyDataB64;
  return { ok: true, data };
}

export function register(): void {
  const clients = new Map<string, { client: MqttClient; reconnectPeriod: number }>();
  const pending = new Map<string, { timer: NodeJS.Timeout }>();

  const send = (id: string, ev: string, data?: unknown) => {
    BrowserWindow.getAllWindows().forEach((w) => {
      try {
        w.webContents.send('mqtt:event', id, ev, data);
      } catch {
        void 0;
      }
    });
  };

  ipcMain.handle('mqtt:connect', async (_event, params: unknown) => {
    const parsed = parseParams(params);
    if (!parsed.ok) return err('invalid_params', parsed.error);
    const p = parsed.data;

    const existingPending = pending.get(p.id);
    if (existingPending) {
      try {
        clearTimeout(existingPending.timer);
      } catch {
        void 0;
      }
      pending.delete(p.id);
    }

    const existing = clients.get(p.id);
    if (existing) {
      try {
        existing.client.end(true);
      } catch {
        void 0;
      }
      clients.delete(p.id);
    }

    const url = buildUrl(p);
    const mqttVersion = String(p.mqttVersion ?? '5.0');
    type LookupFn = (hostname: string, options: unknown, cb?: unknown) => void;
    type ClientOptionsExt = IClientOptions & { servername?: string; lookup?: LookupFn };
    const opts: ClientOptionsExt = {
      clientId: p.clientId,
      connectTimeout: Math.max(1, Math.min(60, Number(p.connectTimeout ?? 10))) * 1000,
      keepalive: Math.max(1, Math.min(3600, Number(p.keepAlive ?? 60))),
      clean: Boolean(p.cleanStart ?? true),
      reconnectPeriod: p.autoReconnect === false ? 0 : Math.max(0, Math.min(60000, Number(p.reconnectPeriod ?? 4000))),
      protocolVersion: mqttVersion === '5.0' ? 5 : mqttVersion === '3.1' ? 3 : 4,
    };

    if (typeof p.username === 'string' && p.username) opts.username = p.username;
    if (typeof p.password === 'string' && p.password) opts.password = p.password;

    const isTls = p.protocol === 'mqtts://' || p.protocol === 'wss://';
    if (isTls) {
      opts.rejectUnauthorized = p.sslSecure !== false;
      opts.servername = p.host;
      if (typeof p.alpn === 'string' && p.alpn.trim()) {
        opts.ALPNProtocols = p.alpn
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (typeof p.caDataB64 === 'string' && p.caDataB64) opts.ca = Buffer.from(p.caDataB64, 'base64');
      if (typeof p.clientCertDataB64 === 'string' && p.clientCertDataB64)
        opts.cert = Buffer.from(p.clientCertDataB64, 'base64');
      if (typeof p.clientKeyDataB64 === 'string' && p.clientKeyDataB64)
        opts.key = Buffer.from(p.clientKeyDataB64, 'base64');
    }

    if (typeof p.lastWillTopic === 'string' && p.lastWillTopic) {
      opts.will = {
        topic: p.lastWillTopic,
        payload: typeof p.lastWillMessage === 'string' ? p.lastWillMessage : '',
        qos: (Number(p.lastWillQos) as 0 | 1 | 2) ?? 0,
        retain: Boolean(p.lastWillRetain),
      };
    }

    if (mqttVersion === '5.0' && Number(p.sessionExpiry ?? 0) > 0) {
      opts.properties = { sessionExpiryInterval: Number(p.sessionExpiry) };
    }

    try {
      log('connect:start', {
        id: p.id,
        url,
        protocolVersion: opts.protocolVersion,
        connectTimeoutMs: opts.connectTimeout,
        keepalive: opts.keepalive,
        clean: opts.clean,
        reconnectPeriod: opts.reconnectPeriod,
        rejectUnauthorized: opts.rejectUnauthorized,
        alpn: Array.isArray(opts.ALPNProtocols) ? opts.ALPNProtocols : undefined,
        caBytes: bufLen(opts.ca),
        certBytes: bufLen(opts.cert),
        keyBytes: bufLen(opts.key),
      });

      try {
        const addrs = await dns.lookup(p.host, { all: true });
        const hasV4 = addrs.some((a) => a.family === 4);
        const hasV6 = addrs.some((a) => a.family === 6);
        log('dns:ok', {
          id: p.id,
          host: p.host,
          addrs: addrs.map((a) => ({ address: a.address, family: a.family })),
        });

        if (hasV4 && hasV6) {
          log('dns:prefer', { id: p.id, host: p.host, family: 4 });
          opts.lookup = (hostname: string, options: unknown, cb?: unknown) => {
            const callback = typeof options === 'function' ? options : cb;
            const rawOptions = typeof options === 'function' ? {} : options;
            if (typeof callback !== 'function') return;
            const wantsAll = isRecord(rawOptions) && rawOptions.all === true;
            if (wantsAll) {
              const nextOptions = (isRecord(rawOptions)
                ? { ...rawOptions, all: true, family: 0 }
                : { all: true, family: 0 }) as dnsCb.LookupAllOptions;
              const cbAll = callback as (err: NodeJS.ErrnoException | null, addresses: dnsCb.LookupAddress[]) => void;
              dnsCb.lookup(hostname, nextOptions, (e, addrs) => {
                if (e) return cbAll(e, addrs);
                const sorted = addrs
                  .slice()
                  .sort((a, b) => (a.family === 4 ? 0 : 1) - (b.family === 4 ? 0 : 1));
                cbAll(null, sorted);
              });
              return;
            }

            const nextOptions = (isRecord(rawOptions)
              ? { ...rawOptions, family: 4, all: false }
              : { family: 4, all: false }) as dnsCb.LookupOneOptions;
            const cbOne = callback as (err: NodeJS.ErrnoException | null, address: string, family: number) => void;
            dnsCb.lookup(hostname, nextOptions, cbOne);
          };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log('dns:error', { id: p.id, host: p.host, message: msg });
      }

      const mqtt = await import('mqtt');
      const client = mqtt.connect(url, opts);
      clients.set(p.id, { client, reconnectPeriod: Number(opts.reconnectPeriod ?? 0) });

      let connectedOnce = false;
      const connectTimeoutMs = Number(opts.connectTimeout ?? 10000);
      const timer = setTimeout(() => {
        const rec = clients.get(p.id);
        if (!rec) return;
        if (connectedOnce || rec.client.connected) return;
        log('connect:timeout', { id: p.id, timeoutMs: connectTimeoutMs });
        send(p.id, 'error', { message: 'Connect timeout' });
        try {
          rec.client.end(true);
        } catch {
          void 0;
        }
        clients.delete(p.id);
        pending.delete(p.id);
        send(p.id, 'close');
      }, Math.max(1000, Math.min(60000, connectTimeoutMs)));
      pending.set(p.id, { timer });

      client.on('connect', () => {
        connectedOnce = true;
        const pend = pending.get(p.id);
        if (pend) {
          clearTimeout(pend.timer);
          pending.delete(p.id);
        }
        log('connect:ok', { id: p.id });
        send(p.id, 'connected');
      });
      client.on('reconnect', () => {
        log('reconnect', { id: p.id });
        send(p.id, 'reconnect');
      });
      client.on('close', () => {
        const pend = pending.get(p.id);
        if (pend) {
          clearTimeout(pend.timer);
          pending.delete(p.id);
        }
        log('close', { id: p.id, connectedOnce });
        send(p.id, 'close');
        const rec = clients.get(p.id);
        if (rec && rec.reconnectPeriod === 0) {
          clients.delete(p.id);
        }
      });
      client.on('offline', () => {
        log('offline', { id: p.id });
        send(p.id, 'offline');
      });
      client.on('error', (e: Error) => {
        const rec: Record<string, unknown> = isRecord(e) ? e : {};
        const code = typeof rec['code'] === 'string' ? String(rec['code']) : undefined;
        const errno = typeof rec['errno'] === 'number' ? Number(rec['errno']) : undefined;
        const syscall = typeof rec['syscall'] === 'string' ? String(rec['syscall']) : undefined;
        const address = typeof rec['address'] === 'string' ? String(rec['address']) : undefined;
        const port = typeof rec['port'] === 'number' ? Number(rec['port']) : undefined;
        log('error', {
          id: p.id,
          name: e.name,
          message: e.message,
          code,
          errno,
          syscall,
          address,
          port,
        });
        send(p.id, 'error', {
          message: e.message,
          code,
          errno,
          syscall,
          address,
          port,
        });
      });
      client.on('message', (topic: string, payload: Buffer, packet: IPublishPacket) => {
        send(p.id, 'message', {
          topic,
          payload: payload.toString('utf-8'),
          qos: packet.qos ?? 0,
          retain: packet.retain ?? false,
        });
      });

      setTimeout(() => {
        const stream = (client as unknown as { stream?: unknown }).stream;
        if (!isRecord(stream)) return;
        if (typeof stream.on !== 'function') return;
        const s = stream as Record<string, unknown> & { on: (event: string, listener: (...args: unknown[]) => void) => unknown };
        const base = () => ({
          id: p.id,
          localAddress: s.localAddress,
          localPort: s.localPort,
          remoteAddress: s.remoteAddress,
          remotePort: s.remotePort,
          authorized: s.authorized,
          authorizationError: s.authorizationError,
          alpnProtocol: s.alpnProtocol,
          servername: s.servername,
        });
        s.on('connect', () => log('stream:connect', base()));
        s.on('secureConnect', () => log('stream:secureConnect', base()));
        s.on('timeout', () => log('stream:timeout', base()));
        s.on('error', (e: unknown) => {
          const er = isRecord(e) ? e : {};
          log('stream:error', {
            ...base(),
            name: typeof er.name === 'string' ? er.name : '',
            message: typeof er.message === 'string' ? er.message : '',
            code: typeof er.code === 'string' ? er.code : undefined,
            errno: typeof er.errno === 'number' ? er.errno : undefined,
            syscall: typeof er.syscall === 'string' ? er.syscall : undefined,
          });
        });
      }, 0);

      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('mqtt:disconnect', (_event, id: string) => {
    const key = String(id ?? '');
    log('disconnect', { id: key });
    const pend = pending.get(key);
    if (pend) {
      clearTimeout(pend.timer);
      pending.delete(key);
    }

    const c = clients.get(key);
    if (c?.client) {
      try {
        c.client.end(true);
      } catch {
        void 0;
      }
      clients.delete(key);
    }
    send(key, 'close');
    return ok(true);
  });

  ipcMain.handle('mqtt:subscribe', (_event, id: string, topic: string, qos: number) => {
    const c = clients.get(String(id ?? ''))?.client;
    if (!c?.connected) return err('io_error', 'MQTT client not connected');
    try {
      c.subscribe(String(topic ?? ''), { qos: (Number(qos) as 0 | 1 | 2) ?? 0 });
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('mqtt:unsubscribe', (_event, id: string, topic: string) => {
    const c = clients.get(String(id ?? ''))?.client;
    if (!c?.connected) return err('io_error', 'MQTT client not connected');
    try {
      c.unsubscribe(String(topic ?? ''));
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });

  ipcMain.handle('mqtt:publish', (_event, id: string, topic: string, payload: string, qos: number, retain: boolean) => {
    const c = clients.get(String(id ?? ''))?.client;
    if (!c?.connected) return err('io_error', 'MQTT client not connected');
    try {
      c.publish(String(topic ?? ''), String(payload ?? ''), { qos: (Number(qos) as 0 | 1 | 2) ?? 0, retain: Boolean(retain) });
      return ok(true);
    } catch (e: unknown) {
      return err('io_error', e instanceof Error ? e.message : String(e));
    }
  });
}
