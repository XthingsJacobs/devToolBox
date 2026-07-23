import fs from 'node:fs';
import path from 'node:path';
import type { ElectronAPI } from '@devtoolbox/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  send: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: mocks.exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    send: mocks.send,
    on: mocks.on,
    removeListener: mocks.removeListener,
  },
}));

type IpcListener = (event: unknown, ...args: unknown[]) => void;

function extractInterfaceBody(source: string, interfaceName: string): string {
  const interfaceStart = source.indexOf(`export interface ${interfaceName}`);
  if (interfaceStart < 0) throw new Error(`Missing interface ${interfaceName}`);
  const bodyStart = source.indexOf('{', interfaceStart);
  if (bodyStart < 0) throw new Error(`Missing interface body for ${interfaceName}`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart + 1, index);
    }
  }

  throw new Error(`Unclosed interface ${interfaceName}`);
}

function electronApiContractKeys(): string[] {
  const electronApiPath = path.join(process.cwd(), 'core/packages/core/src/electron-api.ts');
  const source = fs.readFileSync(electronApiPath, 'utf-8');
  const body = extractInterfaceBody(source, 'ElectronAPI');
  return Array.from(body.matchAll(/^ {2}([A-Za-z]\w*):/gm), (match) => match[1]).sort();
}

async function loadPreload(): Promise<ElectronAPI> {
  vi.resetModules();
  await import('../index');
  const exposeCalls = mocks.exposeInMainWorld.mock.calls as Array<[string, unknown]>;
  const exposedApi = exposeCalls.find(([name]) => name === 'electronAPI')?.[1];
  if (!exposedApi || typeof exposedApi !== 'object') throw new Error('electronAPI was not exposed');
  return exposedApi as ElectronAPI;
}

function ipcOnHandler(channel: string): IpcListener {
  const listenerCalls = mocks.on.mock.calls as Array<[string, unknown]>;
  const handler = listenerCalls.find(([registeredChannel]) => registeredChannel === channel)?.[1];
  if (typeof handler !== 'function') throw new Error(`Missing IPC listener for ${channel}`);
  return handler as IpcListener;
}

beforeEach(() => {
  vi.resetModules();
  mocks.exposeInMainWorld.mockReset();
  mocks.invoke.mockReset();
  mocks.send.mockReset();
  mocks.on.mockReset();
  mocks.removeListener.mockReset();
  mocks.invoke.mockResolvedValue(undefined);
});

describe('preload ElectronAPI contract', () => {
  it('exposes every ElectronAPI method declared by @devtoolbox/core', async () => {
    const api = await loadPreload();

    expect(mocks.exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(Object.keys(api).sort()).toEqual(electronApiContractKeys());
  });

  it('routes invoke-based API methods to stable IPC channels', async () => {
    const api = await loadPreload();
    const filters = [{ name: 'Text', extensions: ['txt'] }];
    const registryOptions = { force: true };
    const httpParams = { url: 'https://example.com', method: 'GET' };
    const clientCertParams = {
      caCertPem: 'ca-cert',
      caKeyPem: 'ca-key',
      commonName: 'client',
      keySize: 2048,
      validityDays: 30,
    };

    await api.getLocale();
    expect(mocks.invoke).toHaveBeenLastCalledWith('app:getLocale');

    await api.setTheme('light');
    expect(mocks.invoke).toHaveBeenLastCalledWith('app:setTheme', 'light');

    await api.openFile(filters, 'base64');
    expect(mocks.invoke).toHaveBeenLastCalledWith('file:open', filters, 'base64');

    await api.backupExport({ bindToDevice: false });
    expect(mocks.invoke).toHaveBeenLastCalledWith('backup:export', { bindToDevice: false });

    await api.diagnosticsRecord({ level: 'info', source: 'renderer', message: 'ready' });
    expect(mocks.invoke).toHaveBeenLastCalledWith('diagnostics:record', {
      level: 'info',
      source: 'renderer',
      message: 'ready',
    });

    await api.startupRestart('safe');
    expect(mocks.invoke).toHaveBeenLastCalledWith('startup:restart', 'safe');

    await api.marketplaceFetchRegistry('https://example.com/registry.json', registryOptions);
    expect(mocks.invoke).toHaveBeenLastCalledWith(
      'marketplace:fetchRegistry',
      'https://example.com/registry.json',
      registryOptions,
    );

    await api.pluginStorageSet('plugin-a', 'key', { enabled: true });
    expect(mocks.invoke).toHaveBeenLastCalledWith('plugin:storageSet', 'plugin-a', 'key', { enabled: true });

    await api.httpRequest(httpParams);
    expect(mocks.invoke).toHaveBeenLastCalledWith('http:request', httpParams);

    await api.generateCSR({ commonName: 'example.com', keySize: 2048 });
    expect(mocks.invoke).toHaveBeenLastCalledWith('crypto:generateCSR', {
      commonName: 'example.com',
      keySize: 2048,
    });

    await api.generateCA({ commonName: 'Example CA', keySize: 2048, validityDays: 365 });
    expect(mocks.invoke).toHaveBeenLastCalledWith('crypto:generateCA', {
      commonName: 'Example CA',
      keySize: 2048,
      validityDays: 365,
    });

    await api.generateRSAKeyPair({ keySize: 4096 });
    expect(mocks.invoke).toHaveBeenLastCalledWith('crypto:generateRSAKeyPair', { keySize: 4096 });

    await api.generateClientCert(clientCertParams);
    expect(mocks.invoke).toHaveBeenLastCalledWith('crypto:generateClientCert', clientCertParams);

    await api.parseCert('cert-pem');
    expect(mocks.invoke).toHaveBeenLastCalledWith('crypto:parseCert', 'cert-pem');

    await api.getNetworkInfo();
    expect(mocks.invoke).toHaveBeenLastCalledWith('network:getInfo');

    await api.convertAndSaveVideo('webm-base64');
    expect(mocks.invoke).toHaveBeenLastCalledWith('video:convertAndSave', 'webm-base64');

    await api.mqttConnect({ id: 'conn-1', host: 'example.com' });
    expect(mocks.invoke).toHaveBeenLastCalledWith('mqtt:connect', { id: 'conn-1', host: 'example.com' });

    await api.mqttDisconnect('conn-1');
    expect(mocks.invoke).toHaveBeenLastCalledWith('mqtt:disconnect', 'conn-1');

    await api.mqttSubscribe('conn-1', 'topic/a', 1);
    expect(mocks.invoke).toHaveBeenLastCalledWith('mqtt:subscribe', 'conn-1', 'topic/a', 1);

    await api.mqttUnsubscribe('conn-1', 'topic/a');
    expect(mocks.invoke).toHaveBeenLastCalledWith('mqtt:unsubscribe', 'conn-1', 'topic/a');

    await api.mqttPublish('conn-1', 'topic/a', 'payload', 1, false);
    expect(mocks.invoke).toHaveBeenLastCalledWith('mqtt:publish', 'conn-1', 'topic/a', 'payload', 1, false);

    await api.wsServerStart({ port: 8080 });
    expect(mocks.invoke).toHaveBeenLastCalledWith('wsServer:start', { port: 8080 });

    await api.wsServerStop();
    expect(mocks.invoke).toHaveBeenLastCalledWith('wsServer:stop');

    await api.wsServerStatus();
    expect(mocks.invoke).toHaveBeenLastCalledWith('wsServer:status');

    await api.wsServerSend({ clientId: 'client-1', data: 'hello' });
    expect(mocks.invoke).toHaveBeenLastCalledWith('wsServer:send', { clientId: 'client-1', data: 'hello' });

    await api.wsServerKick({ clientId: 'client-1' });
    expect(mocks.invoke).toHaveBeenLastCalledWith('wsServer:kick', { clientId: 'client-1' });

    await api.wsServerStressStart({ intervalMs: 1000, payloadBytes: 64 });
    expect(mocks.invoke).toHaveBeenLastCalledWith('wsServer:stressStart', {
      intervalMs: 1000,
      payloadBytes: 64,
    });

    await api.wsServerStressStop();
    expect(mocks.invoke).toHaveBeenLastCalledWith('wsServer:stressStop');
  });

  it('routes fire-and-forget commands and removable stream listeners', async () => {
    const api = await loadPreload();
    const pingData = vi.fn();
    const mqttEvent = vi.fn();
    const wsEvent = vi.fn();

    api.pingStart('example.com', 4);
    expect(mocks.send).toHaveBeenLastCalledWith('ping:start', 'example.com', 4);

    api.pingStop();
    expect(mocks.send).toHaveBeenLastCalledWith('ping:stop');

    api.tracertStart('example.com', 30);
    expect(mocks.send).toHaveBeenLastCalledWith('tracert:start', 'example.com', 30);

    api.tracertStop();
    expect(mocks.send).toHaveBeenLastCalledWith('tracert:stop');

    const pingHandler = api.onPingData(pingData);
    const latestPingHandler = mocks.on.mock.calls.at(-1)?.[1] as IpcListener;
    latestPingHandler({}, '64 bytes from example.com');
    expect(pingData).toHaveBeenCalledWith('64 bytes from example.com');

    api.offPingListeners(pingHandler, undefined, undefined);
    expect(mocks.removeListener).toHaveBeenLastCalledWith('ping:data', pingHandler);

    const mqttHandler = api.onMqttEvent(mqttEvent);
    const latestMqttHandler = mocks.on.mock.calls.at(-1)?.[1] as IpcListener;
    latestMqttHandler({}, 'conn-1', 'message', { topic: 'topic/a' });
    expect(mqttEvent).toHaveBeenCalledWith('conn-1', 'message', { topic: 'topic/a' });

    api.offMqttEvent(mqttHandler);
    expect(mocks.removeListener).toHaveBeenLastCalledWith('mqtt:event', mqttHandler);

    const wsHandler = api.onWsServerEvent(wsEvent);
    const latestWsHandler = mocks.on.mock.calls.at(-1)?.[1] as IpcListener;
    latestWsHandler(
      {},
      {
        type: 'status',
        status: { running: false, url: '', tls: false, clients: [], stats: { totalRecv: 0, totalSent: 0 } },
      },
    );
    expect(wsEvent).toHaveBeenCalledWith({
      type: 'status',
      status: { running: false, url: '', tls: false, clients: [], stats: { totalRecv: 0, totalSent: 0 } },
    });

    api.offWsServerEvent(wsHandler);
    expect(mocks.removeListener).toHaveBeenLastCalledWith('wsServer:event', wsHandler);
  });

  it('filters app preference events before notifying renderer callbacks', async () => {
    const api = await loadPreload();
    const localeChanged = vi.fn();
    const themeChanged = vi.fn();
    const openSettings = vi.fn();

    api.onLocaleChanged(localeChanged);
    ipcOnHandler('locale:changed')({}, 'fr-FR');
    ipcOnHandler('locale:changed')({}, 'zh-CN');
    expect(localeChanged).toHaveBeenCalledTimes(1);
    expect(localeChanged).toHaveBeenCalledWith('zh-CN');

    api.onThemeChanged(themeChanged);
    ipcOnHandler('theme:changed')({}, 'sepia');
    ipcOnHandler('theme:changed')({}, 'dark');
    expect(themeChanged).toHaveBeenCalledTimes(1);
    expect(themeChanged).toHaveBeenCalledWith('dark');

    api.onOpenSettings(openSettings);
    ipcOnHandler('app:openSettings')({});
    expect(openSettings).toHaveBeenCalledOnce();

    api.offLocaleChanged(localeChanged);
    api.offThemeChanged(themeChanged);
    api.offOpenSettings(openSettings);
    ipcOnHandler('locale:changed')({}, 'en');
    ipcOnHandler('theme:changed')({}, 'light');
    ipcOnHandler('app:openSettings')({});
    expect(localeChanged).toHaveBeenCalledTimes(1);
    expect(themeChanged).toHaveBeenCalledTimes(1);
    expect(openSettings).toHaveBeenCalledOnce();
  });
});
