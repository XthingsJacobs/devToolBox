import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  BackupExportOptions,
  BackupImportParams,
  CertificateSubjectParams,
  ElectronAPI,
  GenerateCaParams,
  GenerateClientCertParams,
  HttpRequestParams,
  IpcEventContract,
  IpcInvokeContract,
  IpcSendContract,
  Locale,
  LocaleSetting,
  MarketplaceRegistryEntry,
  RendererDiagnosticEventInput,
  StartupRestartMode,
  Theme,
  ThemeSetting,
  WebSocketServerEvent,
} from '@devtoolbox/core';

type Listener = (...args: unknown[]) => void;

function invoke<Channel extends keyof IpcInvokeContract>(
  channel: Channel,
  ...args: IpcInvokeContract[Channel]['args']
): Promise<IpcInvokeContract[Channel]['result']> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcInvokeContract[Channel]['result']>;
}

function send<Channel extends keyof IpcSendContract>(
  channel: Channel,
  ...args: IpcSendContract[Channel]['args']
): void {
  ipcRenderer.send(channel, ...args);
}

type IpcEventListener<Channel extends keyof IpcEventContract> = (
  _event: IpcRendererEvent,
  ...args: IpcEventContract[Channel]['args']
) => void;

function on<Channel extends keyof IpcEventContract>(
  channel: Channel,
  listener: IpcEventListener<Channel>,
): IpcEventListener<Channel> {
  ipcRenderer.on(channel, listener as Listener);
  return listener;
}

function removeListener<Channel extends keyof IpcEventContract>(channel: Channel, listener: unknown): void {
  if (typeof listener === 'function') ipcRenderer.removeListener(channel, listener as Listener);
}

const localeCallbacks = new Set<(locale: Locale) => void>();
on('locale:changed', (_event, locale) => {
  if (locale === 'en' || locale === 'zh-CN') localeCallbacks.forEach((callback) => callback(locale));
});

const themeCallbacks = new Set<(theme: Theme) => void>();
on('theme:changed', (_event, theme) => {
  if (theme === 'dark' || theme === 'light') themeCallbacks.forEach((callback) => callback(theme));
});

const openSettingsCallbacks = new Set<() => void>();
on('app:openSettings', () => {
  openSettingsCallbacks.forEach((cb) => cb());
});

const openAboutCallbacks = new Set<() => void>();
on('app:openAbout', () => {
  openAboutCallbacks.forEach((cb) => cb());
});

const openExportCallbacks = new Set<() => void>();
on('app:openExport', () => {
  openExportCallbacks.forEach((cb) => cb());
});

const openImportCallbacks = new Set<() => void>();
on('app:openImport', () => {
  openImportCallbacks.forEach((cb) => cb());
});

const electronAPI = {
  setLocale: (locale: LocaleSetting) => invoke('app:setLocale', locale),
  getLocale: () => invoke('app:getLocale'),
  setTheme: (theme: ThemeSetting) => invoke('app:setTheme', theme),
  getTheme: () => invoke('app:getTheme'),
  onLocaleChanged: (cb: (locale: Locale) => void) => {
    localeCallbacks.add(cb);
  },
  offLocaleChanged: (cb: (locale: Locale) => void) => {
    localeCallbacks.delete(cb);
  },
  onThemeChanged: (cb: (theme: Theme) => void) => {
    themeCallbacks.add(cb);
  },
  offThemeChanged: (cb: (theme: Theme) => void) => {
    themeCallbacks.delete(cb);
  },
  onOpenSettings: (cb: () => void) => {
    openSettingsCallbacks.add(cb);
  },
  offOpenSettings: (cb: () => void) => {
    openSettingsCallbacks.delete(cb);
  },
  onOpenAbout: (cb: () => void) => {
    openAboutCallbacks.add(cb);
  },
  offOpenAbout: (cb: () => void) => {
    openAboutCallbacks.delete(cb);
  },
  onOpenExport: (cb: () => void) => {
    openExportCallbacks.add(cb);
  },
  offOpenExport: (cb: () => void) => {
    openExportCallbacks.delete(cb);
  },
  onOpenImport: (cb: () => void) => {
    openImportCallbacks.add(cb);
  },
  offOpenImport: (cb: () => void) => {
    openImportCallbacks.delete(cb);
  },
  backupExport: (options: BackupExportOptions) => invoke('backup:export', options),
  backupImport: (params: BackupImportParams) => invoke('backup:import', params),
  openFile: (filters?: { name: string; extensions: string[] }[], encoding?: string) =>
    invoke('file:open', filters, encoding),
  saveFile: (filePath: string, content: string) => invoke('file:save', filePath, content),
  saveFileAs: (defaultName: string, content: string, filters?: { name: string; extensions: string[] }[]) =>
    invoke('file:saveAs', defaultName, content, filters),
  confirmOverwrite: (filePath: string) => invoke('file:confirmOverwrite', filePath),
  getAppInfo: () => invoke('app:getInfo'),
  getAppIcon: (size?: 'small' | 'normal' | 'large') => invoke('app:getIcon', size),
  diagnosticsRecord: (event: RendererDiagnosticEventInput) => invoke('diagnostics:record', event),
  diagnosticsList: () => invoke('diagnostics:list'),
  diagnosticsClear: () => invoke('diagnostics:clear'),
  diagnosticsExport: () => invoke('diagnostics:export'),
  startupGetStatus: () => invoke('startup:getStatus'),
  startupRendererReady: () => invoke('startup:rendererReady'),
  startupRestart: (mode: StartupRestartMode) => invoke('startup:restart', mode),
  getSystemInfo: () => invoke('system:getInfo'),
  generateCSR: (params: CertificateSubjectParams) => invoke('crypto:generateCSR', params),
  generateCA: (params: GenerateCaParams) => invoke('crypto:generateCA', params),
  generateRSAKeyPair: (params: { keySize: number }) => invoke('crypto:generateRSAKeyPair', params),
  generateClientCert: (params: GenerateClientCertParams) => invoke('crypto:generateClientCert', params),
  parseCert: (certPem: string) => invoke('crypto:parseCert', certPem),
  getNetworkInfo: () => invoke('network:getInfo'),
  pingStart: (host: string, count?: number) => send('ping:start', host, count),
  pingStop: () => send('ping:stop'),
  onPingData: (cb: (data: string) => void) => {
    return on('ping:data', (_e, data) => cb(data));
  },
  onPingError: (cb: (err: string) => void) => {
    return on('ping:error', (_e, err) => cb(err));
  },
  onPingDone: (cb: () => void) => {
    return on('ping:done', () => cb());
  },
  offPingListeners: (dataHandler: unknown, errorHandler: unknown, doneHandler: unknown) => {
    removeListener('ping:data', dataHandler);
    removeListener('ping:error', errorHandler);
    removeListener('ping:done', doneHandler);
  },
  tracertStart: (host: string, maxHops?: number) => send('tracert:start', host, maxHops),
  tracertStop: () => send('tracert:stop'),
  onTracertData: (cb: (data: string) => void) => {
    return on('tracert:data', (_e, data) => cb(data));
  },
  onTracertError: (cb: (err: string) => void) => {
    return on('tracert:error', (_e, err) => cb(err));
  },
  onTracertDone: (cb: () => void) => {
    return on('tracert:done', () => cb());
  },
  offTracertListeners: (dataHandler: unknown, errorHandler: unknown, doneHandler: unknown) => {
    removeListener('tracert:data', dataHandler);
    removeListener('tracert:error', errorHandler);
    removeListener('tracert:done', doneHandler);
  },
  convertAndSaveVideo: (webmBase64: string) => invoke('video:convertAndSave', webmBase64),

  // Marketplace
  marketplaceListInstalled: () => invoke('marketplace:listInstalled'),
  marketplaceInstall: (entry: MarketplaceRegistryEntry) => invoke('marketplace:install', entry),
  marketplaceUninstall: (id: string) => invoke('marketplace:uninstall', id),
  marketplaceSetEnabled: (id: string, enabled: boolean) => invoke('marketplace:setEnabled', id, enabled),
  marketplaceFetchRegistry: (url: string, options?: { force?: boolean }) =>
    invoke('marketplace:fetchRegistry', url, options),

  // Plugin SDK
  pluginHttpRequest: (pluginId: string, params: unknown) => invoke('plugin:httpRequest', pluginId, params),
  pluginStorageGet: (pluginId: string, key: string) => invoke('plugin:storageGet', pluginId, key),
  pluginStorageSet: (pluginId: string, key: string, value: unknown) =>
    invoke('plugin:storageSet', pluginId, key, value),
  pluginStorageDelete: (pluginId: string, key: string) => invoke('plugin:storageDelete', pluginId, key),
  pluginStorageList: (pluginId: string, prefix?: string) => invoke('plugin:storageList', pluginId, prefix),
  pluginStorageClear: (pluginId: string) => invoke('plugin:storageClear', pluginId),
  pluginFsOpenFileDialog: (pluginId: string, params: unknown) =>
    invoke('plugin:fsOpenFileDialog', pluginId, params),
  pluginFsSaveFileDialog: (pluginId: string, params: unknown) =>
    invoke('plugin:fsSaveFileDialog', pluginId, params),
  pluginFsReadFile: (pluginId: string, fileToken: string, encoding?: string) =>
    invoke('plugin:fsReadFile', pluginId, fileToken, encoding),
  pluginFsWriteFile: (pluginId: string, fileToken: string, content: string, encoding?: string) =>
    invoke('plugin:fsWriteFile', pluginId, fileToken, content, encoding),
  pluginSystemOpenExternal: (pluginId: string, url: string) =>
    invoke('plugin:systemOpenExternal', pluginId, url),
  pluginSystemRevealPath: (pluginId: string, pathToken: string) =>
    invoke('plugin:systemRevealPath', pluginId, pathToken),
  pluginSystemOpenPath: (pluginId: string, pathToken: string) =>
    invoke('plugin:systemOpenPath', pluginId, pathToken),
  pluginSystemNotify: (pluginId: string, params: unknown) => invoke('plugin:systemNotify', pluginId, params),
  pluginSystemGetInfo: (pluginId: string) => invoke('plugin:systemGetInfo', pluginId),
  pluginSystemGetEnv: (pluginId: string, keys: string[]) => invoke('plugin:systemGetEnv', pluginId, keys),
  pluginLog: (pluginId: string, params: unknown) => invoke('plugin:log', pluginId, params),
  httpRequest: (params: HttpRequestParams) => invoke('http:request', params),
  mqttConnect: (params: unknown) => invoke('mqtt:connect', params),
  mqttDisconnect: (id: string) => invoke('mqtt:disconnect', id),
  mqttSubscribe: (id: string, topic: string, qos: number) => invoke('mqtt:subscribe', id, topic, qos),
  mqttUnsubscribe: (id: string, topic: string) => invoke('mqtt:unsubscribe', id, topic),
  mqttPublish: (id: string, topic: string, payload: string, qos: number, retain: boolean) =>
    invoke('mqtt:publish', id, topic, payload, qos, retain),
  onMqttEvent: (cb: (id: string, event: string, data?: unknown) => void) => {
    return on('mqtt:event', (_e, id, ev, data) => cb(id, ev, data));
  },
  offMqttEvent: (handler: unknown) => {
    removeListener('mqtt:event', handler);
  },

  wsServerStart: (params: unknown) => invoke('wsServer:start', params),
  wsServerStop: () => invoke('wsServer:stop'),
  wsServerStatus: () => invoke('wsServer:status'),
  wsServerSend: (params: unknown) => invoke('wsServer:send', params),
  wsServerKick: (params: unknown) => invoke('wsServer:kick', params),
  wsServerStressStart: (params: unknown) => invoke('wsServer:stressStart', params),
  wsServerStressStop: () => invoke('wsServer:stressStop'),
  onWsServerEvent: (cb: (ev: WebSocketServerEvent) => void) => {
    return on('wsServer:event', (_e, ev) => cb(ev));
  },
  offWsServerEvent: (handler: unknown) => {
    removeListener('wsServer:event', handler);
  },
} satisfies ElectronAPI;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
