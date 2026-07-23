import type { InstalledMarketplacePlugin, MarketplaceRegistryEntry } from './types';
import { marketplaceService } from '../services';

export async function listInstalledPlugins(): Promise<InstalledMarketplacePlugin[]> {
  return (await marketplaceService.listInstalled()) ?? [];
}

export async function installPlugin(
  entry: MarketplaceRegistryEntry,
): Promise<{ success: boolean; error?: string }> {
  return (await marketplaceService.install(entry)) ?? { success: false, error: 'electronAPI not available' };
}

export async function uninstallPlugin(id: string): Promise<{ success: boolean; error?: string }> {
  return (await marketplaceService.uninstall(id)) ?? { success: false, error: 'electronAPI not available' };
}

export async function setPluginEnabled(
  id: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  return (
    (await marketplaceService.setEnabled(id, enabled)) ?? {
      success: false,
      error: 'electronAPI not available',
    }
  );
}
