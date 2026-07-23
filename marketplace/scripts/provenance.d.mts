import type { KeyObject } from 'node:crypto';
import type { MarketplaceProvenanceSource, MarketplaceRegistryEntry } from '@devtoolbox/core';

export interface MarketplaceSigningConfig {
  privateKey: KeyObject;
  publicKey: string;
  publisher: string;
  keyId: string;
  source: MarketplaceProvenanceSource;
}

export function provenancePayload(entry: MarketplaceRegistryEntry): string;
export function signingConfigFromEnvironment(
  environment?: NodeJS.ProcessEnv,
): MarketplaceSigningConfig | undefined;
export function assertSigningEntryTrusted(
  entry: MarketplaceRegistryEntry,
  config: MarketplaceSigningConfig,
  trustConfig: unknown,
): void;
export function signMarketplaceEntry(
  entry: MarketplaceRegistryEntry,
  config: MarketplaceSigningConfig,
): MarketplaceRegistryEntry;
