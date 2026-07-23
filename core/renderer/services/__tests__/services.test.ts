import type { ElectronAPI, MarketplaceRegistryEntry } from '@devtoolbox/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appService,
  backupService,
  cryptoService,
  diagnosticsService,
  fileService,
  marketplaceService,
  networkService,
  pluginService,
} from '../index';

type ApiCalls = Partial<Record<keyof ElectronAPI, unknown[][]>>;

function setElectronApi(api: ElectronAPI | undefined): void {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    writable: true,
    value: api,
  });
}

function createMockApi(): { api: ElectronAPI; calls: ApiCalls } {
  const calls: ApiCalls = {};
  const api = new Proxy(
    {},
    {
      get(_target, prop: string | symbol) {
        if (typeof prop !== 'string') return undefined;
        return (...args: unknown[]) => {
          const key = prop as keyof ElectronAPI;
          calls[key] = [...(calls[key] ?? []), args];
          return `${prop}:result`;
        };
      },
    },
  ) as ElectronAPI;

  return { api, calls };
}

beforeEach(() => {
  setElectronApi(undefined);
});

afterEach(() => {
  setElectronApi(undefined);
  vi.restoreAllMocks();
});

describe('renderer services', () => {
  it('keeps service methods mapped to the Electron API facade', () => {
    const { api, calls } = createMockApi();
    setElectronApi(api);
    const callback = vi.fn();
    const entry: MarketplaceRegistryEntry = {
      manifest: {
        id: 'market-example',
        name: 'Example',
        description: 'Example plugin',
        version: '1.0.0',
        sdkVersion: '1.0',
        entry: 'index.html',
        categoryId: 'dev-tools',
        author: 'DevToolBox',
        license: 'Apache-2.0',
        homepage: 'https://example.com',
        repository: 'https://example.com/repo',
        permissions: ['storage:kv'],
      },
      downloadUrl: 'https://example.com/plugin.zip',
      sha256: 'a'.repeat(64),
    };

    const cases: Array<{
      name: string;
      call: () => unknown;
      apiMethod: keyof ElectronAPI;
      args: unknown[];
      returns?: boolean;
    }> = [
      { name: 'app.getInfo', call: () => appService.getInfo(), apiMethod: 'getAppInfo', args: [] },
      {
        name: 'app.getIcon',
        call: () => appService.getIcon('small'),
        apiMethod: 'getAppIcon',
        args: ['small'],
      },
      {
        name: 'app.setLocale',
        call: () => appService.setLocale('zh-CN'),
        apiMethod: 'setLocale',
        args: ['zh-CN'],
      },
      { name: 'app.getLocale', call: () => appService.getLocale(), apiMethod: 'getLocale', args: [] },
      {
        name: 'app.setTheme',
        call: () => appService.setTheme('light'),
        apiMethod: 'setTheme',
        args: ['light'],
      },
      { name: 'app.getTheme', call: () => appService.getTheme(), apiMethod: 'getTheme', args: [] },
      {
        name: 'app.getStartupStatus',
        call: () => appService.getStartupStatus(),
        apiMethod: 'startupGetStatus',
        args: [],
      },
      {
        name: 'app.rendererReady',
        call: () => appService.rendererReady(),
        apiMethod: 'startupRendererReady',
        args: [],
      },
      {
        name: 'app.restart',
        call: () => appService.restart('safe'),
        apiMethod: 'startupRestart',
        args: ['safe'],
      },
      {
        name: 'backup.exportBackup',
        call: () => backupService.exportBackup({ bindToDevice: false }),
        apiMethod: 'backupExport',
        args: [{ bindToDevice: false }],
      },
      {
        name: 'backup.importBackup',
        call: () => backupService.importBackup({ content: 'backup', encoding: 'utf8' }),
        apiMethod: 'backupImport',
        args: [{ content: 'backup', encoding: 'utf8' }],
      },
      {
        name: 'file.openFile',
        call: () => fileService.openFile([{ name: 'JSON', extensions: ['json'] }], 'utf8'),
        apiMethod: 'openFile',
        args: [[{ name: 'JSON', extensions: ['json'] }], 'utf8'],
      },
      {
        name: 'file.saveFile',
        call: () => fileService.saveFile('/tmp/a.txt', 'content'),
        apiMethod: 'saveFile',
        args: ['/tmp/a.txt', 'content'],
      },
      {
        name: 'file.saveFileAs',
        call: () => fileService.saveFileAs('a.txt', 'content', [{ name: 'Text', extensions: ['txt'] }]),
        apiMethod: 'saveFileAs',
        args: ['a.txt', 'content', [{ name: 'Text', extensions: ['txt'] }]],
      },
      {
        name: 'file.confirmOverwrite',
        call: () => fileService.confirmOverwrite('/tmp/a.txt'),
        apiMethod: 'confirmOverwrite',
        args: ['/tmp/a.txt'],
      },
      {
        name: 'crypto.generateCSR',
        call: () => cryptoService.generateCSR({ commonName: 'example.com', keySize: 2048 }),
        apiMethod: 'generateCSR',
        args: [{ commonName: 'example.com', keySize: 2048 }],
      },
      {
        name: 'crypto.generateCA',
        call: () => cryptoService.generateCA({ commonName: 'Example CA', keySize: 2048, validityDays: 365 }),
        apiMethod: 'generateCA',
        args: [{ commonName: 'Example CA', keySize: 2048, validityDays: 365 }],
      },
      {
        name: 'crypto.generateRSAKeyPair',
        call: () => cryptoService.generateRSAKeyPair({ keySize: 4096 }),
        apiMethod: 'generateRSAKeyPair',
        args: [{ keySize: 4096 }],
      },
      {
        name: 'crypto.generateClientCert',
        call: () =>
          cryptoService.generateClientCert({
            caCertPem: 'ca-cert',
            caKeyPem: 'ca-key',
            commonName: 'client',
            keySize: 2048,
            validityDays: 30,
          }),
        apiMethod: 'generateClientCert',
        args: [
          {
            caCertPem: 'ca-cert',
            caKeyPem: 'ca-key',
            commonName: 'client',
            keySize: 2048,
            validityDays: 30,
          },
        ],
      },
      {
        name: 'crypto.parseCert',
        call: () => cryptoService.parseCert('cert-pem'),
        apiMethod: 'parseCert',
        args: ['cert-pem'],
      },
      {
        name: 'diagnostics.record',
        call: () => diagnosticsService.record({ level: 'info', source: 'renderer', message: 'event' }),
        apiMethod: 'diagnosticsRecord',
        args: [{ level: 'info', source: 'renderer', message: 'event' }],
      },
      {
        name: 'diagnostics.list',
        call: () => diagnosticsService.list(),
        apiMethod: 'diagnosticsList',
        args: [],
      },
      {
        name: 'diagnostics.clear',
        call: () => diagnosticsService.clear(),
        apiMethod: 'diagnosticsClear',
        args: [],
      },
      {
        name: 'diagnostics.export',
        call: () => diagnosticsService.export(),
        apiMethod: 'diagnosticsExport',
        args: [],
      },
      {
        name: 'marketplace.listInstalled',
        call: () => marketplaceService.listInstalled(),
        apiMethod: 'marketplaceListInstalled',
        args: [],
      },
      {
        name: 'marketplace.install',
        call: () => marketplaceService.install(entry),
        apiMethod: 'marketplaceInstall',
        args: [entry],
      },
      {
        name: 'marketplace.uninstall',
        call: () => marketplaceService.uninstall('market-example'),
        apiMethod: 'marketplaceUninstall',
        args: ['market-example'],
      },
      {
        name: 'marketplace.setEnabled',
        call: () => marketplaceService.setEnabled('market-example', false),
        apiMethod: 'marketplaceSetEnabled',
        args: ['market-example', false],
      },
      {
        name: 'marketplace.fetchRegistry',
        call: () => marketplaceService.fetchRegistry('https://example.com/registry.json', { force: true }),
        apiMethod: 'marketplaceFetchRegistry',
        args: ['https://example.com/registry.json', { force: true }],
      },
      {
        name: 'network.getNetworkInfo',
        call: () => networkService.getNetworkInfo(),
        apiMethod: 'getNetworkInfo',
        args: [],
      },
      {
        name: 'network.httpRequest',
        call: () => networkService.httpRequest({ url: 'https://example.com', method: 'GET' }),
        apiMethod: 'httpRequest',
        args: [{ url: 'https://example.com', method: 'GET' }],
      },
      {
        name: 'network.pingStart',
        call: () => networkService.pingStart('example.com', 4),
        apiMethod: 'pingStart',
        args: ['example.com', 4],
        returns: false,
      },
      {
        name: 'network.pingStop',
        call: () => networkService.pingStop(),
        apiMethod: 'pingStop',
        args: [],
        returns: false,
      },
      {
        name: 'network.onPingData',
        call: () => networkService.onPingData(callback),
        apiMethod: 'onPingData',
        args: [callback],
      },
      {
        name: 'network.onPingError',
        call: () => networkService.onPingError(callback),
        apiMethod: 'onPingError',
        args: [callback],
      },
      {
        name: 'network.onPingDone',
        call: () => networkService.onPingDone(callback),
        apiMethod: 'onPingDone',
        args: [callback],
      },
      {
        name: 'network.offPingListeners',
        call: () => networkService.offPingListeners('data-handler', 'error-handler', 'done-handler'),
        apiMethod: 'offPingListeners',
        args: ['data-handler', 'error-handler', 'done-handler'],
        returns: false,
      },
      {
        name: 'network.tracertStart',
        call: () => networkService.tracertStart('example.com', 30),
        apiMethod: 'tracertStart',
        args: ['example.com', 30],
        returns: false,
      },
      {
        name: 'network.tracertStop',
        call: () => networkService.tracertStop(),
        apiMethod: 'tracertStop',
        args: [],
        returns: false,
      },
      {
        name: 'network.onTracertData',
        call: () => networkService.onTracertData(callback),
        apiMethod: 'onTracertData',
        args: [callback],
      },
      {
        name: 'network.onTracertError',
        call: () => networkService.onTracertError(callback),
        apiMethod: 'onTracertError',
        args: [callback],
      },
      {
        name: 'network.onTracertDone',
        call: () => networkService.onTracertDone(callback),
        apiMethod: 'onTracertDone',
        args: [callback],
      },
      {
        name: 'network.offTracertListeners',
        call: () => networkService.offTracertListeners('data-handler', 'error-handler', 'done-handler'),
        apiMethod: 'offTracertListeners',
        args: ['data-handler', 'error-handler', 'done-handler'],
        returns: false,
      },
      {
        name: 'network.mqttConnect',
        call: () => networkService.mqttConnect({ url: 'mqtt://example.com' }),
        apiMethod: 'mqttConnect',
        args: [{ url: 'mqtt://example.com' }],
      },
      {
        name: 'network.mqttDisconnect',
        call: () => networkService.mqttDisconnect('conn-1'),
        apiMethod: 'mqttDisconnect',
        args: ['conn-1'],
      },
      {
        name: 'network.mqttSubscribe',
        call: () => networkService.mqttSubscribe('conn-1', 'topic/a', 1),
        apiMethod: 'mqttSubscribe',
        args: ['conn-1', 'topic/a', 1],
      },
      {
        name: 'network.mqttUnsubscribe',
        call: () => networkService.mqttUnsubscribe('conn-1', 'topic/a'),
        apiMethod: 'mqttUnsubscribe',
        args: ['conn-1', 'topic/a'],
      },
      {
        name: 'network.mqttPublish',
        call: () => networkService.mqttPublish('conn-1', 'topic/a', 'payload', 1, false),
        apiMethod: 'mqttPublish',
        args: ['conn-1', 'topic/a', 'payload', 1, false],
      },
      {
        name: 'network.onMqttEvent',
        call: () => networkService.onMqttEvent(callback),
        apiMethod: 'onMqttEvent',
        args: [callback],
      },
      {
        name: 'network.offMqttEvent',
        call: () => networkService.offMqttEvent('mqtt-handler'),
        apiMethod: 'offMqttEvent',
        args: ['mqtt-handler'],
        returns: false,
      },
      {
        name: 'network.wsServerStatus',
        call: () => networkService.wsServerStatus(),
        apiMethod: 'wsServerStatus',
        args: [],
      },
      {
        name: 'network.wsServerStart',
        call: () => networkService.wsServerStart({ port: 8080 }),
        apiMethod: 'wsServerStart',
        args: [{ port: 8080 }],
      },
      {
        name: 'network.wsServerStop',
        call: () => networkService.wsServerStop(),
        apiMethod: 'wsServerStop',
        args: [],
      },
      {
        name: 'network.wsServerSend',
        call: () => networkService.wsServerSend({ clientId: 'client-1', data: 'hello' }),
        apiMethod: 'wsServerSend',
        args: [{ clientId: 'client-1', data: 'hello' }],
      },
      {
        name: 'network.wsServerKick',
        call: () => networkService.wsServerKick({ clientId: 'client-1' }),
        apiMethod: 'wsServerKick',
        args: [{ clientId: 'client-1' }],
      },
      {
        name: 'network.wsServerStressStart',
        call: () => networkService.wsServerStressStart({ clientId: 'client-1' }),
        apiMethod: 'wsServerStressStart',
        args: [{ clientId: 'client-1' }],
      },
      {
        name: 'network.wsServerStressStop',
        call: () => networkService.wsServerStressStop(),
        apiMethod: 'wsServerStressStop',
        args: [],
      },
      {
        name: 'network.onWsServerEvent',
        call: () => networkService.onWsServerEvent(callback),
        apiMethod: 'onWsServerEvent',
        args: [callback],
      },
      {
        name: 'network.offWsServerEvent',
        call: () => networkService.offWsServerEvent('ws-handler'),
        apiMethod: 'offWsServerEvent',
        args: ['ws-handler'],
        returns: false,
      },
      {
        name: 'plugin.log',
        call: () => pluginService.log('plugin-a', { level: 'info', message: 'hello' }),
        apiMethod: 'pluginLog',
        args: ['plugin-a', { level: 'info', message: 'hello' }],
      },
      {
        name: 'plugin.httpRequest',
        call: () => pluginService.httpRequest('plugin-a', { url: 'https://example.com' }),
        apiMethod: 'pluginHttpRequest',
        args: ['plugin-a', { url: 'https://example.com' }],
      },
      {
        name: 'plugin.storageGet',
        call: () => pluginService.storageGet('plugin-a', 'key'),
        apiMethod: 'pluginStorageGet',
        args: ['plugin-a', 'key'],
      },
      {
        name: 'plugin.storageSet',
        call: () => pluginService.storageSet('plugin-a', 'key', { enabled: true }),
        apiMethod: 'pluginStorageSet',
        args: ['plugin-a', 'key', { enabled: true }],
      },
      {
        name: 'plugin.storageDelete',
        call: () => pluginService.storageDelete('plugin-a', 'key'),
        apiMethod: 'pluginStorageDelete',
        args: ['plugin-a', 'key'],
      },
      {
        name: 'plugin.storageList',
        call: () => pluginService.storageList('plugin-a', 'prefix:'),
        apiMethod: 'pluginStorageList',
        args: ['plugin-a', 'prefix:'],
      },
      {
        name: 'plugin.storageClear',
        call: () => pluginService.storageClear('plugin-a'),
        apiMethod: 'pluginStorageClear',
        args: ['plugin-a'],
      },
      {
        name: 'plugin.fsOpenFileDialog',
        call: () => pluginService.fsOpenFileDialog('plugin-a', { filters: [] }),
        apiMethod: 'pluginFsOpenFileDialog',
        args: ['plugin-a', { filters: [] }],
      },
      {
        name: 'plugin.fsSaveFileDialog',
        call: () => pluginService.fsSaveFileDialog('plugin-a', { defaultName: 'a.txt' }),
        apiMethod: 'pluginFsSaveFileDialog',
        args: ['plugin-a', { defaultName: 'a.txt' }],
      },
      {
        name: 'plugin.fsReadFile',
        call: () => pluginService.fsReadFile('plugin-a', 'file-token', 'utf8'),
        apiMethod: 'pluginFsReadFile',
        args: ['plugin-a', 'file-token', 'utf8'],
      },
      {
        name: 'plugin.fsWriteFile',
        call: () => pluginService.fsWriteFile('plugin-a', 'file-token', 'content', 'utf8'),
        apiMethod: 'pluginFsWriteFile',
        args: ['plugin-a', 'file-token', 'content', 'utf8'],
      },
      {
        name: 'plugin.systemOpenExternal',
        call: () => pluginService.systemOpenExternal('plugin-a', 'https://example.com'),
        apiMethod: 'pluginSystemOpenExternal',
        args: ['plugin-a', 'https://example.com'],
      },
      {
        name: 'plugin.systemRevealPath',
        call: () => pluginService.systemRevealPath('plugin-a', 'path-token'),
        apiMethod: 'pluginSystemRevealPath',
        args: ['plugin-a', 'path-token'],
      },
      {
        name: 'plugin.systemOpenPath',
        call: () => pluginService.systemOpenPath('plugin-a', 'path-token'),
        apiMethod: 'pluginSystemOpenPath',
        args: ['plugin-a', 'path-token'],
      },
      {
        name: 'plugin.systemNotify',
        call: () => pluginService.systemNotify('plugin-a', { title: 'Done' }),
        apiMethod: 'pluginSystemNotify',
        args: ['plugin-a', { title: 'Done' }],
      },
      {
        name: 'plugin.systemGetInfo',
        call: () => pluginService.systemGetInfo('plugin-a'),
        apiMethod: 'pluginSystemGetInfo',
        args: ['plugin-a'],
      },
      {
        name: 'plugin.systemGetEnv',
        call: () => pluginService.systemGetEnv('plugin-a', ['PATH']),
        apiMethod: 'pluginSystemGetEnv',
        args: ['plugin-a', ['PATH']],
      },
    ];

    expect(fileService.isAvailable()).toBe(true);
    expect(networkService.isAvailable()).toBe(true);

    for (const testCase of cases) {
      const result = testCase.call();
      expect(calls[testCase.apiMethod], testCase.name).toEqual([testCase.args]);
      if (testCase.returns !== false) expect(result, testCase.name).toBe(`${testCase.apiMethod}:result`);
      calls[testCase.apiMethod] = [];
    }
  });

  it('returns cleanup functions for app-level subscriptions', () => {
    const { api, calls } = createMockApi();
    setElectronApi(api);
    const callback = vi.fn();

    const subscriptions: Array<{
      subscribe: () => () => void;
      onMethod: keyof ElectronAPI;
      offMethod: keyof ElectronAPI;
    }> = [
      {
        subscribe: () => appService.onLocaleChanged(callback),
        onMethod: 'onLocaleChanged',
        offMethod: 'offLocaleChanged',
      },
      {
        subscribe: () => appService.onThemeChanged(callback),
        onMethod: 'onThemeChanged',
        offMethod: 'offThemeChanged',
      },
      {
        subscribe: () => appService.onOpenSettings(callback),
        onMethod: 'onOpenSettings',
        offMethod: 'offOpenSettings',
      },
      {
        subscribe: () => appService.onOpenAbout(callback),
        onMethod: 'onOpenAbout',
        offMethod: 'offOpenAbout',
      },
      {
        subscribe: () => appService.onOpenExport(callback),
        onMethod: 'onOpenExport',
        offMethod: 'offOpenExport',
      },
      {
        subscribe: () => appService.onOpenImport(callback),
        onMethod: 'onOpenImport',
        offMethod: 'offOpenImport',
      },
    ];

    for (const subscription of subscriptions) {
      const cleanup = subscription.subscribe();
      expect(calls[subscription.onMethod]).toEqual([[callback]]);
      cleanup();
      expect(calls[subscription.offMethod]).toEqual([[callback]]);
      calls[subscription.onMethod] = [];
      calls[subscription.offMethod] = [];
    }
  });

  it('degrades safely when preload is unavailable', () => {
    setElectronApi(undefined);
    const callback = vi.fn();

    expect(fileService.isAvailable()).toBe(false);
    expect(networkService.isAvailable()).toBe(false);
    expect(appService.getInfo()).toBeUndefined();
    expect(backupService.exportBackup({ bindToDevice: false })).toBeUndefined();
    expect(fileService.openFile()).toBeUndefined();
    expect(cryptoService.parseCert('cert-pem')).toBeUndefined();
    expect(diagnosticsService.list()).toBeUndefined();
    expect(marketplaceService.listInstalled()).toBeUndefined();
    expect(networkService.httpRequest({ url: 'https://example.com' })).toBeUndefined();
    expect(pluginService.log('plugin-a', { message: 'hello' })).toBeUndefined();
    expect(() => networkService.pingStart('example.com')).not.toThrow();
    expect(() => networkService.offMqttEvent('mqtt-handler')).not.toThrow();
    expect(appService.onOpenSettings(callback)()).toBeUndefined();
    expect(callback).not.toHaveBeenCalled();
  });
});
