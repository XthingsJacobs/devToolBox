import type { PluginSdkResult } from '@devtoolbox/core';
import { getElectronApi } from '../lib/electron';

export const pluginService = {
  log(pluginId: string, params: unknown): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginLog(pluginId, params);
  },

  httpRequest(pluginId: string, params: unknown): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginHttpRequest(pluginId, params);
  },

  storageGet(pluginId: string, key: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginStorageGet(pluginId, key);
  },

  storageSet(pluginId: string, key: string, value: unknown): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginStorageSet(pluginId, key, value);
  },

  storageDelete(pluginId: string, key: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginStorageDelete(pluginId, key);
  },

  storageList(pluginId: string, prefix?: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginStorageList(pluginId, prefix);
  },

  storageClear(pluginId: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginStorageClear(pluginId);
  },

  fsOpenFileDialog(pluginId: string, params: unknown): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginFsOpenFileDialog(pluginId, params);
  },

  fsSaveFileDialog(pluginId: string, params: unknown): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginFsSaveFileDialog(pluginId, params);
  },

  fsReadFile(pluginId: string, fileToken: string, encoding?: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginFsReadFile(pluginId, fileToken, encoding);
  },

  fsWriteFile(
    pluginId: string,
    fileToken: string,
    content: string,
    encoding?: string,
  ): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginFsWriteFile(pluginId, fileToken, content, encoding);
  },

  systemOpenExternal(pluginId: string, url: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginSystemOpenExternal(pluginId, url);
  },

  systemRevealPath(pluginId: string, pathToken: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginSystemRevealPath(pluginId, pathToken);
  },

  systemOpenPath(pluginId: string, pathToken: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginSystemOpenPath(pluginId, pathToken);
  },

  systemNotify(pluginId: string, params: unknown): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginSystemNotify(pluginId, params);
  },

  systemGetInfo(pluginId: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginSystemGetInfo(pluginId);
  },

  systemGetEnv(pluginId: string, keys: string[]): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.pluginSystemGetEnv(pluginId, keys);
  },
};
