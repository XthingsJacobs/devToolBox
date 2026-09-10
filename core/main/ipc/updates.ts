import { app, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export type UpdateSettings = {
  autoCheck: boolean;
  ignoredVersion?: string;
};

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'update-settings.json');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function loadSettings(): UpdateSettings {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return { autoCheck: false };
    const ac = parsed.autoCheck;
    const iv = parsed.ignoredVersion;
    const autoCheck = typeof ac === 'boolean' ? ac : false;
    const ignoredVersion = typeof iv === 'string' && iv.trim() ? iv.trim() : undefined;
    return { autoCheck, ignoredVersion };
  } catch {
    return { autoCheck: false };
  }
}

function saveSettings(settings: UpdateSettings): void {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  } catch {
    void 0;
  }
}

let current: UpdateSettings = { autoCheck: false };
let onChangedCb: ((settings: UpdateSettings) => void) | null = null;

export function getCurrentUpdateSettings(): UpdateSettings {
  return current;
}

export function setIgnoredUpdateVersion(version: string | undefined): void {
  const v = typeof version === 'string' && version.trim() ? version.trim() : undefined;
  current = { ...current, ignoredVersion: v };
  saveSettings(current);
}

export function register(onChanged: (settings: UpdateSettings) => void): void {
  onChangedCb = onChanged;
  current = loadSettings();
  ipcMain.handle('updates:getSettings', () => current);
  ipcMain.handle('updates:setAutoCheck', (_event, enabled: boolean) => {
    current = { ...current, autoCheck: Boolean(enabled) };
    saveSettings(current);
    onChanged(current);
  });
}

export function applyUpdateSettings(settings: UpdateSettings): void {
  const autoCheck = Boolean(settings?.autoCheck);
  const ignoredVersion =
    typeof settings?.ignoredVersion === 'string' && settings.ignoredVersion.trim() ? settings.ignoredVersion.trim() : undefined;
  current = { autoCheck, ignoredVersion };
  saveSettings(current);
  onChangedCb?.(current);
}
