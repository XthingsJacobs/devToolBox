import type {
  InstalledMarketplacePlugin,
  MarketplaceInstalledProvenance,
  MarketplaceRegistry,
  MarketplaceRegistryEntry,
  PluginSdkResult,
} from './index';

export type Locale = 'en' | 'zh-CN';
export type LocaleSetting = 'auto' | Locale;
export type Theme = 'dark' | 'light';
export type ThemeSetting = 'auto' | Theme;

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenFileResult {
  filePath: string;
  content: string;
}

export interface CertInfo {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  publicKey: Record<string, string>;
  fingerprint256: string;
  fingerprint: string;
  extensions: { name: string; value: string }[];
  isCA: boolean;
  raw: string;
}

export interface AppInfo {
  name: string;
  company: string;
  version: string;
  build: string;
  electron: string;
  chrome: string;
  node: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  osVersion: string;
  hostname: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: string;
  freeMemory: string;
  homeDir: string;
  username: string;
}

export interface NetworkInfo {
  localIPs: string[];
  publicIP: string;
  dnsStatus: string;
  internetStatus: string;
}

export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';
export type DiagnosticSource = 'main' | 'renderer' | 'tool' | 'plugin';

export interface DiagnosticEventInput {
  level: DiagnosticLevel;
  source: DiagnosticSource;
  scope?: string;
  message: string;
  details?: unknown;
}

export interface RendererDiagnosticEventInput extends DiagnosticEventInput {
  source: 'renderer' | 'tool';
}

export interface DiagnosticEvent extends DiagnosticEventInput {
  id: string;
  timestamp: string;
}

export interface DiagnosticLog {
  events: DiagnosticEvent[];
  droppedCount: number;
  maxEvents: number;
  maxBytes: number;
}

export type DiagnosticExportResult =
  | { success: true; filePath: string }
  | { success: false; error: 'canceled' | 'write_failed' };

export type StartupModeReason = 'crash-loop' | 'manual' | null;

export interface StartupStatus {
  safeMode: boolean;
  reason: StartupModeReason;
  consecutiveFailures: number;
  failureThreshold: number;
  startedAt: string;
}

export type StartupRestartMode = 'normal' | 'safe';

export interface BackupExportOptions {
  bindToDevice: boolean;
  password?: string;
  localStorage?: Record<string, string>;
}

export type BackupExportResult =
  | { success: true; filePath: string }
  | { success: false; error: 'canceled' | 'password_too_short' | 'write_failed' | 'invalid_params' };

export interface BackupImportParams {
  content: string;
  password?: string;
  encoding?: 'utf8' | 'base64';
}

export type BackupImportResult =
  | { success: true; localStorage: Record<string, string> }
  | {
      success: false;
      error: 'invalid_file' | 'password_required' | 'decrypt_failed' | 'write_failed' | 'invalid_params';
    };

export interface HttpRequestParams {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  responseType?: 'text' | 'json' | 'arrayBuffer';
  allowHttp?: boolean;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  data: unknown;
}

export interface WebSocketServerClient {
  id: string;
  remote: string;
  connectedAt: string;
  recvCount: number;
  sentCount: number;
}

export interface WebSocketServerStatus {
  running: boolean;
  url: string;
  tls: boolean;
  clients: WebSocketServerClient[];
  stats: { totalRecv: number; totalSent: number };
}

export type WebSocketServerEvent =
  | { type: 'log'; level: 'info' | 'error'; message: string }
  | { type: 'status'; status: WebSocketServerStatus };

export type MarketplaceOperationResult =
  | { success: true; provenance?: MarketplaceInstalledProvenance }
  | { success: false; error: string };
export type MarketplaceRegistryResult =
  | { success: true; registry: MarketplaceRegistry }
  | { success: false; error: string };

export interface CertificateSubjectParams {
  commonName?: string;
  organization?: string;
  organizationalUnit?: string;
  country?: string;
  state?: string;
  locality?: string;
  keySize: number;
}

export interface GenerateCaParams extends CertificateSubjectParams {
  validityDays: number;
}

export interface GenerateClientCertParams extends CertificateSubjectParams {
  caCertPem: string;
  caKeyPem: string;
  csrPem?: string;
  validityDays: number;
}

export type CryptoResult<T extends object> = ({ success: true } & T) | { success: false; error: string };
export type VideoConversionResult = { ok: boolean; filePath?: string; error?: string };

export interface IpcInvokeContract {
  'app:setLocale': { args: [setting: LocaleSetting]; result: void };
  'app:getLocale': { args: []; result: { setting: LocaleSetting; locale: Locale } };
  'app:setTheme': { args: [setting: ThemeSetting]; result: void };
  'app:getTheme': { args: []; result: { setting: ThemeSetting; theme: Theme } };
  'app:getInfo': { args: []; result: AppInfo };
  'app:getIcon': { args: [size?: 'small' | 'normal' | 'large']; result: string | null };
  'diagnostics:record': { args: [event: RendererDiagnosticEventInput]; result: boolean };
  'diagnostics:list': { args: []; result: DiagnosticLog };
  'diagnostics:clear': { args: []; result: boolean };
  'diagnostics:export': { args: []; result: DiagnosticExportResult };
  'startup:getStatus': { args: []; result: StartupStatus };
  'startup:rendererReady': { args: []; result: boolean };
  'startup:restart': { args: [mode: StartupRestartMode]; result: boolean };
  'system:getInfo': { args: []; result: SystemInfo };
  'network:getInfo': { args: []; result: NetworkInfo };
  'file:open': { args: [filters?: FileFilter[], encoding?: string]; result: OpenFileResult | null };
  'file:save': { args: [filePath: string, content: string]; result: boolean };
  'file:saveAs': {
    args: [defaultName: string, content: string, filters?: FileFilter[]];
    result: string | null;
  };
  'file:confirmOverwrite': { args: [filePath: string]; result: boolean };
  'backup:export': { args: [options: BackupExportOptions]; result: BackupExportResult };
  'backup:import': { args: [params: BackupImportParams]; result: BackupImportResult };
  'crypto:generateCSR': {
    args: [params: CertificateSubjectParams];
    result: CryptoResult<{ privateKey: string; csr: string }>;
  };
  'crypto:generateCA': {
    args: [params: GenerateCaParams];
    result: CryptoResult<{ privateKey: string; certificate: string }>;
  };
  'crypto:generateRSAKeyPair': {
    args: [params: { keySize: number }];
    result: CryptoResult<{ publicKey: string; privateKey: string }>;
  };
  'crypto:generateClientCert': {
    args: [params: GenerateClientCertParams];
    result: CryptoResult<{ privateKey?: string; certificate: string; csr?: string }>;
  };
  'crypto:parseCert': { args: [certPem: string]; result: CryptoResult<{ info: CertInfo }> };
  'video:convertAndSave': { args: [webmBase64: string]; result: VideoConversionResult };
  'marketplace:listInstalled': { args: []; result: InstalledMarketplacePlugin[] };
  'marketplace:install': { args: [entry: MarketplaceRegistryEntry]; result: MarketplaceOperationResult };
  'marketplace:uninstall': { args: [id: string]; result: MarketplaceOperationResult };
  'marketplace:setEnabled': {
    args: [id: string, enabled: boolean];
    result: MarketplaceOperationResult;
  };
  'marketplace:fetchRegistry': {
    args: [url: string, options?: { force?: boolean }];
    result: MarketplaceRegistryResult;
  };
  'plugin:httpRequest': { args: [pluginId: string, params: unknown]; result: PluginSdkResult };
  'plugin:storageGet': { args: [pluginId: string, key: string]; result: PluginSdkResult };
  'plugin:storageSet': {
    args: [pluginId: string, key: string, value: unknown];
    result: PluginSdkResult;
  };
  'plugin:storageDelete': { args: [pluginId: string, key: string]; result: PluginSdkResult };
  'plugin:storageList': { args: [pluginId: string, prefix?: string]; result: PluginSdkResult };
  'plugin:storageClear': { args: [pluginId: string]; result: PluginSdkResult };
  'plugin:fsOpenFileDialog': { args: [pluginId: string, params: unknown]; result: PluginSdkResult };
  'plugin:fsSaveFileDialog': { args: [pluginId: string, params: unknown]; result: PluginSdkResult };
  'plugin:fsReadFile': {
    args: [pluginId: string, fileToken: string, encoding?: string];
    result: PluginSdkResult;
  };
  'plugin:fsWriteFile': {
    args: [pluginId: string, fileToken: string, content: string, encoding?: string];
    result: PluginSdkResult;
  };
  'plugin:systemOpenExternal': { args: [pluginId: string, url: string]; result: PluginSdkResult };
  'plugin:systemRevealPath': { args: [pluginId: string, pathToken: string]; result: PluginSdkResult };
  'plugin:systemOpenPath': { args: [pluginId: string, pathToken: string]; result: PluginSdkResult };
  'plugin:systemNotify': { args: [pluginId: string, params: unknown]; result: PluginSdkResult };
  'plugin:systemGetInfo': { args: [pluginId: string]; result: PluginSdkResult };
  'plugin:systemGetEnv': { args: [pluginId: string, keys: string[]]; result: PluginSdkResult };
  'plugin:log': { args: [pluginId: string, params: unknown]; result: PluginSdkResult };
  'http:request': { args: [params: HttpRequestParams]; result: PluginSdkResult<HttpResponse> };
  'mqtt:connect': { args: [params: unknown]; result: PluginSdkResult };
  'mqtt:disconnect': { args: [id: string]; result: PluginSdkResult };
  'mqtt:subscribe': { args: [id: string, topic: string, qos: number]; result: PluginSdkResult };
  'mqtt:unsubscribe': { args: [id: string, topic: string]; result: PluginSdkResult };
  'mqtt:publish': {
    args: [id: string, topic: string, payload: string, qos: number, retain: boolean];
    result: PluginSdkResult;
  };
  'wsServer:start': { args: [params: unknown]; result: WebSocketServerStatus };
  'wsServer:stop': { args: []; result: WebSocketServerStatus };
  'wsServer:status': { args: []; result: WebSocketServerStatus };
  'wsServer:send': { args: [params: unknown]; result: boolean };
  'wsServer:kick': { args: [params: unknown]; result: boolean };
  'wsServer:stressStart': { args: [params: unknown]; result: boolean };
  'wsServer:stressStop': { args: []; result: boolean };
}

export interface IpcSendContract {
  'ping:start': { args: [host: string, count?: number] };
  'ping:stop': { args: [] };
  'tracert:start': { args: [host: string, maxHops?: number] };
  'tracert:stop': { args: [] };
}

export interface IpcEventContract {
  'locale:changed': { args: [locale: string] };
  'theme:changed': { args: [theme: string] };
  'app:openSettings': { args: [] };
  'app:openAbout': { args: [] };
  'app:openExport': { args: [] };
  'app:openImport': { args: [] };
  'ping:data': { args: [data: string] };
  'ping:error': { args: [error: string] };
  'ping:done': { args: [] };
  'tracert:data': { args: [data: string] };
  'tracert:error': { args: [error: string] };
  'tracert:done': { args: [] };
  'mqtt:event': { args: [id: string, event: string, data?: unknown] };
  'wsServer:event': { args: [event: WebSocketServerEvent] };
}

export interface ElectronAPI {
  setLocale: (locale: LocaleSetting) => Promise<void>;
  getLocale: () => Promise<{ setting: LocaleSetting; locale: Locale }>;
  setTheme: (theme: ThemeSetting) => Promise<void>;
  getTheme: () => Promise<{ setting: ThemeSetting; theme: Theme }>;
  onLocaleChanged: (callback: (locale: Locale) => void) => void;
  offLocaleChanged: (callback: (locale: Locale) => void) => void;
  onThemeChanged: (callback: (theme: Theme) => void) => void;
  offThemeChanged: (callback: (theme: Theme) => void) => void;
  onOpenSettings: (callback: () => void) => void;
  offOpenSettings: (callback: () => void) => void;
  onOpenAbout: (callback: () => void) => void;
  offOpenAbout: (callback: () => void) => void;
  onOpenExport: (callback: () => void) => void;
  offOpenExport: (callback: () => void) => void;
  onOpenImport: (callback: () => void) => void;
  offOpenImport: (callback: () => void) => void;
  backupExport: (options: BackupExportOptions) => Promise<BackupExportResult>;
  backupImport: (params: BackupImportParams) => Promise<BackupImportResult>;
  openFile: (filters?: FileFilter[], encoding?: string) => Promise<OpenFileResult | null>;
  saveFile: (filePath: string, content: string) => Promise<boolean>;
  saveFileAs: (defaultName: string, content: string, filters?: FileFilter[]) => Promise<string | null>;
  confirmOverwrite: (filePath: string) => Promise<boolean>;
  generateCSR: (
    params: CertificateSubjectParams,
  ) => Promise<CryptoResult<{ privateKey: string; csr: string }>>;
  generateCA: (
    params: GenerateCaParams,
  ) => Promise<CryptoResult<{ privateKey: string; certificate: string }>>;
  generateRSAKeyPair: (params: {
    keySize: number;
  }) => Promise<CryptoResult<{ publicKey: string; privateKey: string }>>;
  generateClientCert: (
    params: GenerateClientCertParams,
  ) => Promise<CryptoResult<{ privateKey?: string; certificate: string; csr?: string }>>;
  parseCert: (certPem: string) => Promise<CryptoResult<{ info: CertInfo }>>;
  getNetworkInfo: () => Promise<NetworkInfo>;
  pingStart: (host: string, count?: number) => void;
  pingStop: () => void;
  onPingData: (callback: (data: string) => void) => unknown;
  onPingError: (callback: (error: string) => void) => unknown;
  onPingDone: (callback: () => void) => unknown;
  offPingListeners: (dataHandler: unknown, errorHandler: unknown, doneHandler: unknown) => void;
  tracertStart: (host: string, maxHops?: number) => void;
  tracertStop: () => void;
  onTracertData: (callback: (data: string) => void) => unknown;
  onTracertError: (callback: (error: string) => void) => unknown;
  onTracertDone: (callback: () => void) => unknown;
  offTracertListeners: (dataHandler: unknown, errorHandler: unknown, doneHandler: unknown) => void;
  getAppInfo: () => Promise<AppInfo>;
  getAppIcon: (size?: 'small' | 'normal' | 'large') => Promise<string | null>;
  diagnosticsRecord: (event: RendererDiagnosticEventInput) => Promise<boolean>;
  diagnosticsList: () => Promise<DiagnosticLog>;
  diagnosticsClear: () => Promise<boolean>;
  diagnosticsExport: () => Promise<DiagnosticExportResult>;
  startupGetStatus: () => Promise<StartupStatus>;
  startupRendererReady: () => Promise<boolean>;
  startupRestart: (mode: StartupRestartMode) => Promise<boolean>;
  getSystemInfo: () => Promise<SystemInfo>;
  convertAndSaveVideo: (webmBase64: string) => Promise<VideoConversionResult>;
  marketplaceListInstalled: () => Promise<InstalledMarketplacePlugin[]>;
  marketplaceInstall: (entry: MarketplaceRegistryEntry) => Promise<MarketplaceOperationResult>;
  marketplaceUninstall: (id: string) => Promise<MarketplaceOperationResult>;
  marketplaceSetEnabled: (id: string, enabled: boolean) => Promise<MarketplaceOperationResult>;
  marketplaceFetchRegistry: (
    url: string,
    options?: { force?: boolean },
  ) => Promise<MarketplaceRegistryResult>;
  pluginHttpRequest: (pluginId: string, params: unknown) => Promise<PluginSdkResult>;
  pluginStorageGet: (pluginId: string, key: string) => Promise<PluginSdkResult>;
  pluginStorageSet: (pluginId: string, key: string, value: unknown) => Promise<PluginSdkResult>;
  pluginStorageDelete: (pluginId: string, key: string) => Promise<PluginSdkResult>;
  pluginStorageList: (pluginId: string, prefix?: string) => Promise<PluginSdkResult>;
  pluginStorageClear: (pluginId: string) => Promise<PluginSdkResult>;
  pluginFsOpenFileDialog: (pluginId: string, params: unknown) => Promise<PluginSdkResult>;
  pluginFsSaveFileDialog: (pluginId: string, params: unknown) => Promise<PluginSdkResult>;
  pluginFsReadFile: (pluginId: string, fileToken: string, encoding?: string) => Promise<PluginSdkResult>;
  pluginFsWriteFile: (
    pluginId: string,
    fileToken: string,
    content: string,
    encoding?: string,
  ) => Promise<PluginSdkResult>;
  pluginSystemOpenExternal: (pluginId: string, url: string) => Promise<PluginSdkResult>;
  pluginSystemRevealPath: (pluginId: string, pathToken: string) => Promise<PluginSdkResult>;
  pluginSystemOpenPath: (pluginId: string, pathToken: string) => Promise<PluginSdkResult>;
  pluginSystemNotify: (pluginId: string, params: unknown) => Promise<PluginSdkResult>;
  pluginSystemGetInfo: (pluginId: string) => Promise<PluginSdkResult>;
  pluginSystemGetEnv: (pluginId: string, keys: string[]) => Promise<PluginSdkResult>;
  pluginLog: (pluginId: string, params: unknown) => Promise<PluginSdkResult>;
  httpRequest: (params: HttpRequestParams) => Promise<PluginSdkResult<HttpResponse>>;
  mqttConnect: (params: unknown) => Promise<PluginSdkResult>;
  mqttDisconnect: (id: string) => Promise<PluginSdkResult>;
  mqttSubscribe: (id: string, topic: string, qos: number) => Promise<PluginSdkResult>;
  mqttUnsubscribe: (id: string, topic: string) => Promise<PluginSdkResult>;
  mqttPublish: (
    id: string,
    topic: string,
    payload: string,
    qos: number,
    retain: boolean,
  ) => Promise<PluginSdkResult>;
  onMqttEvent: (callback: (id: string, event: string, data?: unknown) => void) => unknown;
  offMqttEvent: (handler: unknown) => void;
  wsServerStart: (params: unknown) => Promise<WebSocketServerStatus>;
  wsServerStop: () => Promise<WebSocketServerStatus>;
  wsServerStatus: () => Promise<WebSocketServerStatus>;
  wsServerSend: (params: unknown) => Promise<boolean>;
  wsServerKick: (params: unknown) => Promise<boolean>;
  wsServerStressStart: (params: unknown) => Promise<boolean>;
  wsServerStressStop: () => Promise<boolean>;
  onWsServerEvent: (callback: (event: WebSocketServerEvent) => void) => unknown;
  offWsServerEvent: (handler: unknown) => void;
}
