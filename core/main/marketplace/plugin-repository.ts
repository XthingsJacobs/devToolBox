import type { MarketplaceInstalledProvenance, MarketplacePluginManifest } from '@devtoolbox/core';
import { readMarketplaceState, writeMarketplaceState } from '../storage/plugin-data';
import { validateManifest } from './manifest';

export interface InstalledPluginRecord {
  id: string;
  version: string;
  enabled: boolean;
  installedAt: string;
  manifest: MarketplacePluginManifest;
  provenance?: MarketplaceInstalledProvenance;
}

export interface MarketplaceState {
  installed: Record<string, InstalledPluginRecord>;
}

export interface MarketplaceStateStore {
  read: () => unknown;
  write: (state: MarketplaceState) => void;
}

export function isPluginId(value: unknown): value is string {
  return typeof value === 'string' && /^market-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInstalledProvenance(value: unknown): MarketplaceInstalledProvenance | undefined {
  if (!isRecord(value)) return undefined;
  if (value.status === 'unsigned') return { status: 'unsigned' };
  if (value.status !== 'verified' && value.status !== 'untrusted') return undefined;
  if (
    typeof value.publisher !== 'string' ||
    typeof value.keyId !== 'string' ||
    !isRecord(value.source) ||
    typeof value.source.repository !== 'string' ||
    typeof value.source.revision !== 'string' ||
    (value.source.workflow !== undefined && typeof value.source.workflow !== 'string')
  ) {
    return undefined;
  }
  return {
    status: value.status,
    publisher: value.publisher,
    keyId: value.keyId,
    source: {
      repository: value.source.repository,
      revision: value.source.revision,
      workflow: value.source.workflow,
    },
  };
}

export function parseMarketplaceState(value: unknown): MarketplaceState {
  if (!isRecord(value) || !isRecord(value.installed)) return { installed: {} };

  const installed: Record<string, InstalledPluginRecord> = {};
  for (const [id, candidate] of Object.entries(value.installed)) {
    if (!isPluginId(id) || !isRecord(candidate) || candidate.id !== id) continue;
    if (
      typeof candidate.version !== 'string' ||
      typeof candidate.enabled !== 'boolean' ||
      typeof candidate.installedAt !== 'string'
    ) {
      continue;
    }
    const manifest = validateManifest(candidate.manifest);
    if (!manifest.ok || manifest.data.id !== id || manifest.data.version !== candidate.version) continue;
    installed[id] = {
      id,
      version: candidate.version,
      enabled: candidate.enabled,
      installedAt: candidate.installedAt,
      manifest: manifest.data,
      provenance: parseInstalledProvenance(candidate.provenance),
    };
  }
  return { installed };
}

export class PluginRepository {
  constructor(private readonly store: MarketplaceStateStore) {}

  list(): InstalledPluginRecord[] {
    return Object.values(this.readState().installed);
  }

  get(id: unknown): InstalledPluginRecord | undefined {
    if (!isPluginId(id)) return undefined;
    return this.readState().installed[id];
  }

  setEnabled(id: string, enabled: boolean): boolean {
    const state = this.readState();
    const record = state.installed[id];
    if (!record) return false;
    state.installed[id] = { ...record, enabled };
    this.store.write(state);
    return true;
  }

  save(record: InstalledPluginRecord): InstalledPluginRecord | undefined {
    if (!isPluginId(record.id)) throw new Error('Invalid plugin id');
    const manifest = validateManifest(record.manifest);
    if (!manifest.ok || manifest.data.id !== record.id || manifest.data.version !== record.version) {
      throw new Error('Invalid installed plugin record');
    }
    const state = this.readState();
    const previous = state.installed[record.id];
    state.installed[record.id] = { ...record, manifest: manifest.data };
    this.store.write(state);
    return previous;
  }

  remove(id: string): InstalledPluginRecord | undefined {
    const state = this.readState();
    const previous = state.installed[id];
    if (!previous) return undefined;
    delete state.installed[id];
    this.store.write(state);
    return previous;
  }

  private readState(): MarketplaceState {
    return parseMarketplaceState(this.store.read());
  }
}

export const pluginRepository = new PluginRepository({
  read: readMarketplaceState,
  write: writeMarketplaceState,
});
