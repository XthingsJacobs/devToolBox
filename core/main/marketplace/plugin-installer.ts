import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import extract from 'extract-zip';
import type {
  DiagnosticEventInput,
  MarketplaceInstalledProvenance,
  MarketplaceOperationResult,
  MarketplaceRegistryEntry,
} from '@devtoolbox/core';
import { isForbiddenHostLiteral, requestExternal } from '../ipc/safe-http';
import { validateMarketplaceRegistryEntry } from '../ipc/validation';
import { compareManifests, validateManifest } from './manifest';
import { isPluginId, type PluginRepository } from './plugin-repository';
import { verifyMarketplaceProvenance, type MarketplaceProvenancePolicy } from './provenance';

type DebugLog = (message: string, extra?: Record<string, unknown>) => void;
type ExtractArchive = (zipPath: string, targetDir: string) => Promise<void>;
type PreparedArchive = { ok: true; path: string } | { ok: false; error: string };

export interface PluginInstallerOptions {
  repository: PluginRepository;
  installBaseDir: string;
  zipCacheDir: string;
  tempDir: string;
  pluginDataBaseDir: string;
  isDevelopment: boolean;
  userAgent: string;
  request?: typeof requestExternal;
  extractArchive?: ExtractArchive;
  now?: () => number;
  debug?: DebugLog;
  clearFileTokens?: (pluginId: string) => void;
  clearPluginData?: (pluginId: string) => void;
  provenancePolicy?: MarketplaceProvenancePolicy;
  recordDiagnostic?: (event: DiagnosticEventInput) => void;
}

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 300 * 1024 * 1024;
const MAX_EXTRACTED_FILES = 5000;
const DEFAULT_PROVENANCE_POLICY: MarketplaceProvenancePolicy = { mode: 'audit', publishers: [] };

function failure(error: string): MarketplaceOperationResult {
  return { success: false, error };
}

function removePath(target: string): boolean {
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export function validateExtractedPluginTree(rootDir: string): string | undefined {
  let files = 0;
  let bytes = 0;
  const pending = [rootDir];
  while (pending.length) {
    const current = pending.pop();
    if (!current) break;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      const stat = fs.lstatSync(entryPath);
      if (stat.isSymbolicLink()) return 'Package must not contain symbolic links';
      if (stat.isDirectory()) {
        pending.push(entryPath);
        continue;
      }
      if (!stat.isFile()) return 'Package contains an unsupported file type';
      files += 1;
      bytes += stat.size;
      if (files > MAX_EXTRACTED_FILES) return 'Package contains too many files';
      if (bytes > MAX_EXTRACTED_BYTES) return 'Extracted package is too large';
    }
  }
  return undefined;
}

export class PluginInstaller {
  private readonly request: typeof requestExternal;
  private readonly extractArchive: ExtractArchive;
  private readonly now: () => number;
  private readonly debug: DebugLog;
  private readonly operationTails = new Map<string, Promise<unknown>>();

  constructor(private readonly options: PluginInstallerOptions) {
    this.request = options.request ?? requestExternal;
    this.extractArchive =
      options.extractArchive ?? ((zipPath, targetDir) => extract(zipPath, { dir: targetDir }));
    this.now = options.now ?? Date.now;
    this.debug = options.debug ?? (() => undefined);
  }

  async install(input: unknown): Promise<MarketplaceOperationResult> {
    const validatedEntry = validateMarketplaceRegistryEntry(input);
    if (!validatedEntry.ok) return failure(validatedEntry.error);
    const entry = validatedEntry.data;
    if (entry.status === 'blocked') return failure('Plugin is blocked');
    return this.runExclusive(entry.manifest.id, () => this.installEntry(entry));
  }

  async uninstall(inputId: unknown): Promise<MarketplaceOperationResult> {
    if (!isPluginId(inputId)) return failure('Invalid plugin id');
    return this.runExclusive(inputId, () => Promise.resolve(this.uninstallPlugin(inputId)));
  }

  private async installEntry(entry: MarketplaceRegistryEntry): Promise<MarketplaceOperationResult> {
    const manifest = entry.manifest;
    this.debug('install:start', { id: manifest.id, version: manifest.version, sha256: entry.sha256 });
    try {
      const verification = verifyMarketplaceProvenance(
        entry,
        this.options.provenancePolicy ?? DEFAULT_PROVENANCE_POLICY,
      );
      if (!verification.ok) {
        this.options.recordDiagnostic?.({
          level: 'warn',
          source: 'main',
          scope: `marketplace.provenance.${manifest.id}`,
          message: verification.error,
        });
        return failure(verification.error);
      }
      this.options.recordDiagnostic?.({
        level: verification.provenance.status === 'verified' ? 'info' : 'warn',
        source: 'main',
        scope: `marketplace.provenance.${manifest.id}`,
        message:
          verification.provenance.status === 'verified'
            ? 'Marketplace package provenance verified'
            : verification.provenance.status === 'untrusted'
              ? 'Marketplace package signature uses an untrusted publisher key'
              : 'Marketplace package is unsigned',
        details: {
          status: verification.provenance.status,
          publisher: verification.provenance.publisher,
          keyId: verification.provenance.keyId,
        },
      });
      const zipPath = await this.prepareArchive(entry);
      if (!zipPath.ok) return failure(zipPath.error);
      return await this.installArchive(entry, zipPath.path, verification.provenance);
    } catch (error) {
      this.debug('install:error', { error: error instanceof Error ? error.message : String(error) });
      return failure(error instanceof Error ? error.message : String(error));
    }
  }

  private uninstallPlugin(pluginId: string): MarketplaceOperationResult {
    try {
      const record = this.options.repository.remove(pluginId);
      if (!record) return failure('Plugin not installed');
      try {
        this.options.clearFileTokens?.(record.id);
      } catch (error) {
        this.debug('uninstall:token-cleanup-failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      try {
        this.options.clearPluginData?.(record.id);
      } catch (error) {
        this.debug('uninstall:data-cleanup-failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      const pluginDir = path.join(this.options.installBaseDir, record.id);
      const legacyDataDir = path.join(this.options.pluginDataBaseDir, record.id);
      if (!removePath(pluginDir)) this.debug('uninstall:cleanup-failed', { path: pluginDir });
      if (!removePath(legacyDataDir)) this.debug('uninstall:cleanup-failed', { path: legacyDataDir });
      this.debug('uninstall:ok', { id: record.id, version: record.version });
      return { success: true };
    } catch (error) {
      return failure(error instanceof Error ? error.message : String(error));
    }
  }

  private runExclusive<T>(pluginId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTails.get(pluginId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.operationTails.set(pluginId, current);
    return current.finally(() => {
      if (this.operationTails.get(pluginId) === current) this.operationTails.delete(pluginId);
    });
  }

  private async prepareArchive(entry: MarketplaceRegistryEntry): Promise<PreparedArchive> {
    fs.mkdirSync(this.options.zipCacheDir, { recursive: true });
    const cachedPath = path.join(this.options.zipCacheDir, `${entry.sha256}.zip`);
    if (fs.existsSync(cachedPath)) {
      if (await this.archiveMatches(cachedPath, entry)) {
        this.debug('install:zip:cache-hit', { cachedPath });
        return { ok: true, path: cachedPath };
      }
      removePath(cachedPath);
      this.debug('install:zip:cache-invalid', { cachedPath });
    }

    let downloadUrl: URL;
    try {
      downloadUrl = new URL(entry.downloadUrl);
    } catch {
      return { ok: false, error: 'Invalid downloadUrl' };
    }

    if (downloadUrl.protocol === 'file:') {
      if (!this.options.isDevelopment) {
        return { ok: false, error: 'Only https downloadUrl is allowed' };
      }
      const sourcePath = fileURLToPath(downloadUrl);
      if (!fs.existsSync(sourcePath)) return { ok: false, error: 'Zip file not found' };
      const stat = fs.statSync(sourcePath);
      if (!stat.isFile()) return { ok: false, error: 'Zip path is not a file' };
      if (stat.size > MAX_ARCHIVE_BYTES) return { ok: false, error: 'Zip file too large' };
      if (!(await this.archiveMatches(sourcePath, entry))) {
        return { ok: false, error: 'SHA256 or package size mismatch' };
      }
      fs.copyFileSync(sourcePath, cachedPath);
      this.debug('install:zip:cached', { cachedPath });
      return { ok: true, path: cachedPath };
    }

    if (downloadUrl.protocol !== 'https:') {
      return { ok: false, error: 'Only https downloadUrl is allowed' };
    }
    if (downloadUrl.hostname === 'example.invalid') {
      return { ok: false, error: 'Registry is using placeholder downloadUrl.' };
    }
    if (isForbiddenHostLiteral(downloadUrl.hostname)) {
      return { ok: false, error: 'Forbidden download host' };
    }

    fs.mkdirSync(this.options.tempDir, { recursive: true });
    const tempPath = path.join(
      this.options.tempDir,
      `devtoolbox_${entry.manifest.id}_${this.now()}_${crypto.randomUUID()}.zip`,
    );
    try {
      this.debug('download:start', { url: downloadUrl.toString() });
      const response = await this.request(
        {
          url: downloadUrl.toString(),
          timeoutMs: 30_000,
          responseType: 'arrayBuffer',
          headers: {
            'user-agent': this.options.userAgent,
            accept: 'application/octet-stream, */*',
          },
        },
        { maxBytes: MAX_ARCHIVE_BYTES },
      );
      if (response.status < 200 || response.status >= 300) {
        return { ok: false, error: `HTTP ${response.status}` };
      }
      const buffer = Buffer.from(String(response.data ?? ''), 'base64');
      fs.writeFileSync(tempPath, buffer);
      if (!(await this.archiveMatches(tempPath, entry))) {
        return { ok: false, error: 'SHA256 or package size mismatch' };
      }
      try {
        fs.renameSync(tempPath, cachedPath);
      } catch {
        fs.copyFileSync(tempPath, cachedPath);
      }
      this.debug('install:zip:cached', { cachedPath, size: buffer.byteLength });
      return { ok: true, path: cachedPath };
    } finally {
      removePath(tempPath);
    }
  }

  private async archiveMatches(filePath: string, entry: MarketplaceRegistryEntry): Promise<boolean> {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size > MAX_ARCHIVE_BYTES) return false;
      if (entry.size !== undefined && stat.size !== entry.size) return false;
      return (await sha256File(filePath)).toLowerCase() === entry.sha256;
    } catch {
      return false;
    }
  }

  private async installArchive(
    entry: MarketplaceRegistryEntry,
    zipPath: string,
    provenance: MarketplaceInstalledProvenance,
  ): Promise<MarketplaceOperationResult> {
    const manifest = entry.manifest;
    const pluginRoot = path.join(this.options.installBaseDir, manifest.id);
    const targetDir = path.join(pluginRoot, manifest.version);
    const nonce = crypto.randomUUID();
    const stagingDir = path.join(pluginRoot, `.staging-${manifest.version}-${nonce}`);
    const backupDir = path.join(pluginRoot, `.backup-${manifest.version}-${nonce}`);
    fs.mkdirSync(pluginRoot, { recursive: true });
    removePath(stagingDir);
    fs.mkdirSync(stagingDir, { recursive: true });

    try {
      this.debug('install:extract', { zipPath, stagingDir });
      await this.extractArchive(zipPath, stagingDir);
      const treeError = validateExtractedPluginTree(stagingDir);
      if (treeError) return failure(treeError);

      const manifestPath = path.join(stagingDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) return failure('manifest.json not found in package');
      const packageManifest = validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as unknown);
      if (!packageManifest.ok) return failure(`Invalid manifest.json: ${packageManifest.error}`);
      const differences = compareManifests(manifest, packageManifest.data);
      if (differences.length) return failure(`manifest mismatch: ${differences.join(', ')}`);

      const entryPath = path.resolve(stagingDir, manifest.entry);
      const realRoot = fs.realpathSync(stagingDir);
      const realEntry = fs.realpathSync(entryPath);
      if (!realEntry.startsWith(`${realRoot}${path.sep}`) || !fs.statSync(realEntry).isFile()) {
        return failure('Invalid entry path');
      }

      const previous = this.options.repository.get(manifest.id);
      let previousTargetMoved = false;
      if (fs.existsSync(targetDir)) {
        removePath(backupDir);
        fs.renameSync(targetDir, backupDir);
        previousTargetMoved = true;
      }

      let activated = false;
      try {
        fs.renameSync(stagingDir, targetDir);
        activated = true;
        this.options.repository.save({
          id: manifest.id,
          version: manifest.version,
          enabled: previous?.enabled ?? true,
          installedAt: new Date(this.now()).toISOString(),
          manifest: packageManifest.data,
          provenance,
        });
      } catch (error) {
        if (activated) removePath(targetDir);
        if (previousTargetMoved) fs.renameSync(backupDir, targetDir);
        throw error;
      }

      removePath(backupDir);
      if (previous && previous.version !== manifest.version) {
        removePath(path.join(pluginRoot, previous.version));
      }
      this.debug('install:ok', { id: manifest.id, version: manifest.version });
      return { success: true, provenance };
    } catch (error) {
      return failure(error instanceof Error ? error.message : String(error));
    } finally {
      removePath(stagingDir);
    }
  }
}
