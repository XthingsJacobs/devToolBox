import type {
  InstalledMarketplacePlugin,
  MarketplaceOperationResult,
  MarketplaceRegistryEntry,
  MarketplaceRegistryResult,
} from '@devtoolbox/core';
import { getElectronApi } from '../lib/electron';

export const marketplaceService = {
  listInstalled(): Promise<InstalledMarketplacePlugin[]> | undefined {
    return getElectronApi()?.marketplaceListInstalled();
  },

  install(entry: MarketplaceRegistryEntry): Promise<MarketplaceOperationResult> | undefined {
    return getElectronApi()?.marketplaceInstall(entry);
  },

  uninstall(id: string): Promise<MarketplaceOperationResult> | undefined {
    return getElectronApi()?.marketplaceUninstall(id);
  },

  setEnabled(id: string, enabled: boolean): Promise<MarketplaceOperationResult> | undefined {
    return getElectronApi()?.marketplaceSetEnabled(id, enabled);
  },

  fetchRegistry(url: string, options?: { force?: boolean }): Promise<MarketplaceRegistryResult> | undefined {
    return getElectronApi()?.marketplaceFetchRegistry(url, options);
  },
};
