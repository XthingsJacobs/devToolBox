/**
 * Data migration engine.
 * Runs on renderer startup and executes migrations in version order.
 */

interface Migration {
  version: string;
  migrate: () => void;
}

// Auto-scan all migration files under migrations/
const migrationFiles = import.meta.glob<{ version: string; migrate: () => void }>('./v*.ts', { eager: true });

// Sort by version
const migrations: Migration[] = Object.values(migrationFiles)
  .map((m) => ({ version: m.version, migrate: m.migrate }))
  .sort((a, b) => compareVersions(a.version, b.version));

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

const DATA_VERSION_KEY = 'devtoolbox_data_version';
const BACKUP_PREFIX = 'devtoolbox_backup_';

function getCurrentDataVersion(): string {
  return localStorage.getItem(DATA_VERSION_KEY) || '1.0.0';
}

function backupData(version: string): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('devtoolbox_'));
  const backup: Record<string, string> = {};
  for (const k of keys) {
    backup[k] = localStorage.getItem(k) || '';
  }
  localStorage.setItem(`${BACKUP_PREFIX}${version}`, JSON.stringify(backup));
}

export function runMigrations(appVersion: string): void {
  const dataVersion = getCurrentDataVersion();

  if (compareVersions(dataVersion, appVersion) >= 0) return;

  // Pick pending migrations
  const pending = migrations.filter(
    (m) => compareVersions(m.version, dataVersion) > 0 && compareVersions(m.version, appVersion) <= 0,
  );

  if (pending.length === 0) {
    localStorage.setItem(DATA_VERSION_KEY, appVersion);
    return;
  }

  // Backup before migrating
  backupData(dataVersion);

  // Execute in order
  for (const m of pending) {
    try {
      m.migrate();
      localStorage.setItem(DATA_VERSION_KEY, m.version);
    } catch (err) {
      console.error(`Migration to ${m.version} failed:`, err);
      break;
    }
  }

  // Finally set data version to the app version
  localStorage.setItem(DATA_VERSION_KEY, appVersion);
}
