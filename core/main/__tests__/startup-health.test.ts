import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { StartupHealthTracker } from '../startup-health';

const temporaryDirectories: string[] = [];

function healthFile(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-startup-health-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'startup.json');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('StartupHealthTracker', () => {
  it('enters safe mode on the third launch after two incomplete startups', () => {
    const filePath = healthFile();
    const first = new StartupHealthTracker({ filePath }).beginStartup();
    const second = new StartupHealthTracker({ filePath }).beginStartup();
    const third = new StartupHealthTracker({ filePath }).beginStartup();

    expect(first).toMatchObject({ safeMode: false, consecutiveFailures: 0, reason: null });
    expect(second).toMatchObject({ safeMode: false, consecutiveFailures: 1, reason: null });
    expect(third).toMatchObject({ safeMode: true, consecutiveFailures: 2, reason: 'crash-loop' });
    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it('resets the failure sequence after renderer health confirmation or a clean exit', () => {
    const filePath = healthFile();
    const first = new StartupHealthTracker({ filePath });
    first.beginStartup();
    first.markRendererReady();

    const afterHealthy = new StartupHealthTracker({ filePath });
    expect(afterHealthy.beginStartup()).toMatchObject({ safeMode: false, consecutiveFailures: 0 });
    afterHealthy.markCleanExit();

    expect(new StartupHealthTracker({ filePath }).beginStartup()).toMatchObject({
      safeMode: false,
      consecutiveFailures: 0,
    });
  });

  it('supports an explicit one-shot safe-mode restart without changing persistent plugin state', () => {
    const filePath = healthFile();
    const current = new StartupHealthTracker({ filePath });
    current.beginStartup();
    current.prepareRestart('safe');
    current.markCleanExit();

    const safeSession = new StartupHealthTracker({ filePath });
    expect(safeSession.beginStartup()).toMatchObject({
      safeMode: true,
      reason: 'manual',
      consecutiveFailures: 0,
    });
    safeSession.markRendererReady();

    expect(new StartupHealthTracker({ filePath }).beginStartup()).toMatchObject({
      safeMode: false,
      reason: null,
    });
  });

  it('can explicitly leave an automatic safe-mode loop', () => {
    const filePath = healthFile();
    new StartupHealthTracker({ filePath }).beginStartup();
    new StartupHealthTracker({ filePath }).beginStartup();
    const safeSession = new StartupHealthTracker({ filePath });
    expect(safeSession.beginStartup().safeMode).toBe(true);

    safeSession.prepareRestart('normal');
    safeSession.markCleanExit();
    expect(new StartupHealthTracker({ filePath }).beginStartup()).toMatchObject({
      safeMode: false,
      consecutiveFailures: 0,
    });
  });
});
