import type { StartupRestartMode, StartupStatus } from '@devtoolbox/core';
import { readJsonFile, writeJsonAtomic } from './storage/atomic-json';

const DEFAULT_FAILURE_THRESHOLD = 2;

type StartupPhase = 'starting' | 'healthy' | 'clean';

interface StartupHealthFile {
  schemaVersion: 1;
  phase: StartupPhase;
  consecutiveFailures: number;
  forceSafeModeNext: boolean;
  lastStartedAt?: string;
  lastHealthyAt?: string;
  lastCleanExitAt?: string;
}

export interface StartupHealthOptions {
  filePath: string;
  failureThreshold?: number;
  now?: () => number;
  onPersistenceError?: (error: unknown) => void;
}

function defaultState(): StartupHealthFile {
  return {
    schemaVersion: 1,
    phase: 'clean',
    consecutiveFailures: 0,
    forceSafeModeNext: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function readState(filePath: string): StartupHealthFile {
  const value = readJsonFile(filePath);
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    (value.phase !== 'starting' && value.phase !== 'healthy' && value.phase !== 'clean') ||
    typeof value.consecutiveFailures !== 'number' ||
    !Number.isSafeInteger(value.consecutiveFailures) ||
    value.consecutiveFailures < 0 ||
    typeof value.forceSafeModeNext !== 'boolean'
  ) {
    return defaultState();
  }
  return {
    schemaVersion: 1,
    phase: value.phase,
    consecutiveFailures: Math.min(99, value.consecutiveFailures),
    forceSafeModeNext: value.forceSafeModeNext,
    lastStartedAt: validTimestamp(value.lastStartedAt) ? value.lastStartedAt : undefined,
    lastHealthyAt: validTimestamp(value.lastHealthyAt) ? value.lastHealthyAt : undefined,
    lastCleanExitAt: validTimestamp(value.lastCleanExitAt) ? value.lastCleanExitAt : undefined,
  };
}

export class StartupHealthTracker {
  readonly failureThreshold: number;
  private readonly now: () => number;
  private state: StartupHealthFile;
  private session: StartupStatus | undefined;

  constructor(private readonly options: StartupHealthOptions) {
    this.failureThreshold = Math.max(1, Math.floor(options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD));
    this.now = options.now ?? Date.now;
    this.state = readState(options.filePath);
  }

  beginStartup(): StartupStatus {
    if (this.session) return this.session;
    const previousFailed = this.state.phase === 'starting';
    const consecutiveFailures = previousFailed ? Math.min(99, this.state.consecutiveFailures + 1) : 0;
    const forced = this.state.forceSafeModeNext;
    const safeMode = forced || consecutiveFailures >= this.failureThreshold;
    const startedAt = new Date(this.now()).toISOString();

    this.state = {
      ...this.state,
      phase: 'starting',
      consecutiveFailures,
      forceSafeModeNext: false,
      lastStartedAt: startedAt,
    };
    this.session = {
      safeMode,
      reason: forced ? 'manual' : safeMode ? 'crash-loop' : null,
      consecutiveFailures,
      failureThreshold: this.failureThreshold,
      startedAt,
    };
    this.persist();
    return this.session;
  }

  getStatus(): StartupStatus {
    return this.beginStartup();
  }

  markRendererReady(): void {
    this.beginStartup();
    this.state = {
      ...this.state,
      phase: 'healthy',
      consecutiveFailures: 0,
      forceSafeModeNext: false,
      lastHealthyAt: new Date(this.now()).toISOString(),
    };
    this.persist();
  }

  markCleanExit(): void {
    this.beginStartup();
    this.state = {
      ...this.state,
      phase: 'clean',
      consecutiveFailures: 0,
      lastCleanExitAt: new Date(this.now()).toISOString(),
    };
    this.persist();
  }

  prepareRestart(mode: StartupRestartMode): void {
    this.beginStartup();
    this.state = {
      ...this.state,
      phase: 'healthy',
      consecutiveFailures: 0,
      forceSafeModeNext: mode === 'safe',
    };
    this.persist();
  }

  private persist(): void {
    try {
      writeJsonAtomic(this.options.filePath, this.state);
    } catch (error) {
      this.options.onPersistenceError?.(error);
    }
  }
}
