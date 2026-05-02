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
  cpuModel: string;
  cpuCores: number;
  totalMem: number;
  freeMem: number;
  hostname: string;
}

export interface ElectronAPI {
  setLocale: (locale: string) => Promise<void>;
  getLocale: () => Promise<string>;
  onLocaleChanged: (cb: (event: any, locale: string) => void) => void;
  offLocaleChanged: (cb: (event: any, locale: string) => void) => void;
  onOpenSettings: (cb: () => void) => void;
  offOpenSettings: (cb: () => void) => void;
  onOpenExport: (cb: () => void) => void;
  offOpenExport: (cb: () => void) => void;
  onOpenImport: (cb: () => void) => void;
  offOpenImport: (cb: () => void) => void;
  backupExport: (options: {
    bindToDevice: boolean;
    password?: string;
    localStorage?: Record<string, string>;
  }) => Promise<{ success: boolean; filePath?: string; error?: 'canceled' | 'write_failed' }>;
  backupImport: (params: { content: string; password?: string; encoding?: 'utf8' | 'base64' }) => Promise<{
    success: boolean;
    localStorage?: Record<string, string>;
    error?: 'invalid_file' | 'password_required' | 'decrypt_failed';
  }>;
  openFile: (filters?: FileFilter[], encoding?: string) => Promise<OpenFileResult | null>;
  saveFile: (filePath: string, content: string) => Promise<boolean>;
  saveFileAs: (defaultName: string, content: string, filters?: FileFilter[]) => Promise<string | null>;
  confirmOverwrite: (filePath: string) => Promise<boolean>;
  generateCSR: (params: {
    commonName?: string;
    organization?: string;
    organizationalUnit?: string;
    country?: string;
    state?: string;
    locality?: string;
    keySize: number;
  }) => Promise<{ success: boolean; privateKey?: string; csr?: string; error?: string }>;
  generateCA: (params: {
    commonName?: string;
    organization?: string;
    organizationalUnit?: string;
    country?: string;
    state?: string;
    locality?: string;
    keySize: number;
    validityDays: number;
  }) => Promise<{ success: boolean; privateKey?: string; certificate?: string; error?: string }>;
  generateClientCert: (params: {
    caCertPem: string;
    caKeyPem: string;
    csrPem?: string;
    commonName?: string;
    organization?: string;
    organizationalUnit?: string;
    country?: string;
    state?: string;
    locality?: string;
    keySize: number;
    validityDays: number;
  }) => Promise<{
    success: boolean;
    privateKey?: string;
    certificate?: string;
    csr?: string;
    error?: string;
  }>;
  parseCert: (certPem: string) => Promise<{ success: boolean; info?: CertInfo; error?: string }>;
  getNetworkInfo: () => Promise<{
    localIPs: string[];
    publicIP: string;
    dnsStatus: string;
    internetStatus: string;
  }>;
  pingStart: (host: string, count?: number) => void;
  pingStop: () => void;
  onPingData: (cb: (data: string) => void) => any;
  onPingError: (cb: (err: string) => void) => any;
  onPingDone: (cb: () => void) => any;
  offPingListeners: (dataHandler: any, errorHandler: any, doneHandler: any) => void;
  tracertStart: (host: string, maxHops?: number) => void;
  tracertStop: () => void;
  onTracertData: (cb: (data: string) => void) => any;
  onTracertError: (cb: (err: string) => void) => any;
  onTracertDone: (cb: () => void) => any;
  offTracertListeners: (dataHandler: any, errorHandler: any, doneHandler: any) => void;
  getAppInfo: () => Promise<AppInfo>;
  getSystemInfo: () => Promise<SystemInfo>;
  convertAndSaveVideo: (webmBase64: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
  // Marketplace
  marketplaceListInstalled: () => Promise<
    {
      id: string;
      version: string;
      enabled: boolean;
      enabled: boolean;
      installedAt: string;
      entryUrl: string;
      manifest: any;
    }[]
  >;
  marketplaceInstall: (entry: any) => Promise<{ success: boolean; error?: string }>;
  marketplaceUninstall: (id: string) => Promise<{ success: boolean; error?: string }>;
  marketplaceSetEnabled: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  marketplaceFetchRegistry: (
    url: string,
    options?: { force?: boolean },
  ) => Promise<{ success: boolean; registry?: unknown; error?: string }>;

  // Plugin SDK (host-implemented)
  pluginHttpRequest: (pluginId: string, params: any) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginStorageGet: (pluginId: string, key: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginStorageSet: (pluginId: string, key: string, value: any) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginStorageDelete: (pluginId: string, key: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginStorageList: (pluginId: string, prefix?: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginStorageClear: (pluginId: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginFsOpenFileDialog: (
    pluginId: string,
    params: any,
  ) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginFsSaveFileDialog: (
    pluginId: string,
    params: any,
  ) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginFsReadFile: (pluginId: string, fileToken: string, encoding?: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginFsWriteFile: (
    pluginId: string,
    fileToken: string,
    content: string,
    encoding?: string,
  ) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginSystemOpenExternal: (pluginId: string, url: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginSystemRevealPath: (pluginId: string, pathToken: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginSystemOpenPath: (pluginId: string, pathToken: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginSystemNotify: (pluginId: string, params: any) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginSystemGetInfo: (pluginId: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginSystemGetEnv: (pluginId: string, keys: string[]) => Promise<{ ok: boolean; data?: any; error?: any }>;
  pluginLog: (pluginId: string, params: any) => Promise<{ ok: boolean; data?: any; error?: any }>;
  httpRequest: (params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    responseType?: 'text' | 'json' | 'arrayBuffer';
    allowHttp?: boolean;
  }) => Promise<{ ok: boolean; data?: any; error?: any }>;
  mqttConnect: (params: any) => Promise<{ ok: boolean; data?: any; error?: any }>;
  mqttDisconnect: (id: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  mqttSubscribe: (id: string, topic: string, qos: number) => Promise<{ ok: boolean; data?: any; error?: any }>;
  mqttUnsubscribe: (id: string, topic: string) => Promise<{ ok: boolean; data?: any; error?: any }>;
  mqttPublish: (
    id: string,
    topic: string,
    payload: string,
    qos: number,
    retain: boolean,
  ) => Promise<{ ok: boolean; data?: any; error?: any }>;
  onMqttEvent: (cb: (id: string, event: string, data?: any) => void) => any;
  offMqttEvent: (handler: any) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
