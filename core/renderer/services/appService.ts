import type {
  AppInfo,
  Locale,
  LocaleSetting,
  StartupRestartMode,
  StartupStatus,
  Theme,
  ThemeSetting,
} from '@devtoolbox/core';
import { getElectronApi } from '../lib/electron';

function subscribe<T>(
  onName: keyof NonNullable<ReturnType<typeof getElectronApi>>,
  offName: keyof NonNullable<ReturnType<typeof getElectronApi>>,
  callback: (value: T) => void,
): () => void {
  const api = getElectronApi() as Record<string, unknown> | undefined;
  const on = api?.[onName];
  const off = api?.[offName];
  if (typeof on !== 'function' || typeof off !== 'function') return () => undefined;
  on.call(api, callback);
  return () => off.call(api, callback);
}

export const appService = {
  getInfo(): Promise<AppInfo> | undefined {
    return getElectronApi()?.getAppInfo();
  },

  getIcon(size?: 'small' | 'normal' | 'large'): Promise<string | null> | undefined {
    return getElectronApi()?.getAppIcon(size);
  },

  setLocale(setting: LocaleSetting): Promise<void> | undefined {
    return getElectronApi()?.setLocale(setting);
  },

  getLocale(): Promise<{ setting: LocaleSetting; locale: Locale }> | undefined {
    return getElectronApi()?.getLocale();
  },

  onLocaleChanged(callback: (locale: Locale) => void): () => void {
    return subscribe('onLocaleChanged', 'offLocaleChanged', callback);
  },

  setTheme(setting: ThemeSetting): Promise<void> | undefined {
    return getElectronApi()?.setTheme(setting);
  },

  getTheme(): Promise<{ setting: ThemeSetting; theme: Theme }> | undefined {
    return getElectronApi()?.getTheme();
  },

  onThemeChanged(callback: (theme: Theme) => void): () => void {
    return subscribe('onThemeChanged', 'offThemeChanged', callback);
  },

  onOpenSettings(callback: () => void): () => void {
    return subscribe('onOpenSettings', 'offOpenSettings', callback);
  },

  onOpenAbout(callback: () => void): () => void {
    return subscribe('onOpenAbout', 'offOpenAbout', callback);
  },

  onOpenExport(callback: () => void): () => void {
    return subscribe('onOpenExport', 'offOpenExport', callback);
  },

  onOpenImport(callback: () => void): () => void {
    return subscribe('onOpenImport', 'offOpenImport', callback);
  },

  getStartupStatus(): Promise<StartupStatus> | undefined {
    return getElectronApi()?.startupGetStatus();
  },

  rendererReady(): Promise<boolean> | undefined {
    return getElectronApi()?.startupRendererReady();
  },

  restart(mode: StartupRestartMode): Promise<boolean> | undefined {
    return getElectronApi()?.startupRestart(mode);
  },
};
