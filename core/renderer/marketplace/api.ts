import type { InstalledMarketplacePlugin, MarketplaceRegistryEntry } from './types';

export async function listInstalledPlugins(): Promise<InstalledMarketplacePlugin[]> {
  return (await window.electronAPI?.marketplaceListInstalled()) ?? [];
}

export async function installPlugin(entry: MarketplaceRegistryEntry): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.marketplaceInstall) return { success: false, error: 'electronAPI not available' };
  return window.electronAPI.marketplaceInstall(entry);
}

export async function uninstallPlugin(id: string): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.marketplaceUninstall) return { success: false, error: 'electronAPI not available' };
  return window.electronAPI.marketplaceUninstall(id);
}

export async function setPluginEnabled(id: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.marketplaceSetEnabled) return { success: false, error: 'electronAPI not available' };
  return window.electronAPI.marketplaceSetEnabled(id, enabled);
}

