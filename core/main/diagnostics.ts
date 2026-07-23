import crypto from 'node:crypto';
import os from 'node:os';
import type {
  DiagnosticEvent,
  DiagnosticEventInput,
  DiagnosticLevel,
  DiagnosticLog,
  DiagnosticSource,
} from '@devtoolbox/core';
import { readJsonFile, writeJsonAtomic } from './storage/atomic-json';

const LEVELS = new Set<DiagnosticLevel>(['debug', 'info', 'warn', 'error']);
const SOURCES = new Set<DiagnosticSource>(['main', 'renderer', 'tool', 'plugin']);
const SENSITIVE_KEY =
  /(?:authorization|cookie|credential|password|passwd|secret|session|token|api[-_]?key|private[-_]?key|content|body|payload|raw[-_]?data)/i;
const DEFAULT_MAX_EVENTS = 500;
const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

interface StoredDiagnostics {
  schemaVersion: 1;
  droppedCount: number;
  events: DiagnosticEvent[];
}

interface RateWindow {
  startedAt: number;
  count: number;
}

export interface DiagnosticStoreOptions {
  filePath: string;
  maxEvents?: number;
  maxBytes?: number;
  maxEventsPerMinute?: number;
  homeDirectory?: string;
  now?: () => number;
  onPersistenceError?: (error: unknown) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactString(value: string, homeDirectory: string, maxLength: number): string {
  let output = value;
  if (homeDirectory) output = output.replace(new RegExp(escapeRegExp(homeDirectory), 'gi'), '~');
  output = output
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
      '[REDACTED PRIVATE KEY]',
    )
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:access_token|api_key|apikey|key|password|secret|token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b(password|passwd|secret|token|api[-_]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/:\/\/[^/@\s]+:[^/@\s]+@/g, '://[REDACTED]@');
  return output.length > maxLength ? `${output.slice(0, maxLength)}…` : output;
}

function sanitizeValue(value: unknown, homeDirectory: string, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined || typeof value === 'boolean') return value;
  if (typeof value === 'string') return redactString(value, homeDirectory, 1000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'symbol' || typeof value === 'function') return `[${typeof value}]`;
  if (depth >= 5) return '[Truncated: depth limit]';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    const cause = 'cause' in value ? (value as Error & { cause?: unknown }).cause : undefined;
    return sanitizeValue(
      { name: value.name, message: value.message, stack: value.stack, cause },
      homeDirectory,
      depth + 1,
      seen,
    );
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const output = value.slice(0, 30).map((item) => sanitizeValue(item, homeDirectory, depth + 1, seen));
    if (value.length > output.length) output.push(`[${value.length - output.length} more items]`);
    return output;
  }

  const output: Record<string, unknown> = {};
  const entries = Object.entries(value).slice(0, 30);
  for (const [rawKey, item] of entries) {
    const key = rawKey.slice(0, 128);
    output[key] = SENSITIVE_KEY.test(key)
      ? '[REDACTED]'
      : sanitizeValue(item, homeDirectory, depth + 1, seen);
  }
  if (Object.keys(value).length > entries.length) {
    output.__truncated__ = `${Object.keys(value).length - entries.length} more properties`;
  }
  return output;
}

export function redactDiagnosticValue(value: unknown, homeDirectory = os.homedir()): unknown {
  try {
    return sanitizeValue(value, homeDirectory, 0, new WeakSet());
  } catch {
    return '[Unserializable diagnostic details]';
  }
}

function validStoredEvent(value: unknown): value is DiagnosticEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.timestamp === 'string' &&
    !Number.isNaN(Date.parse(value.timestamp)) &&
    typeof value.level === 'string' &&
    LEVELS.has(value.level as DiagnosticLevel) &&
    typeof value.source === 'string' &&
    SOURCES.has(value.source as DiagnosticSource) &&
    (value.scope === undefined || typeof value.scope === 'string') &&
    typeof value.message === 'string'
  );
}

export class DiagnosticStore {
  readonly maxEvents: number;
  readonly maxBytes: number;
  private readonly maxEventsPerMinute: number;
  private readonly homeDirectory: string;
  private readonly now: () => number;
  private readonly rateWindows = new Map<string, RateWindow>();
  private events: DiagnosticEvent[] = [];
  private droppedCount = 0;

  constructor(private readonly options: DiagnosticStoreOptions) {
    this.maxEvents = Math.max(1, Math.floor(options.maxEvents ?? DEFAULT_MAX_EVENTS));
    this.maxBytes = Math.max(1024, Math.floor(options.maxBytes ?? DEFAULT_MAX_BYTES));
    this.maxEventsPerMinute = Math.max(1, Math.floor(options.maxEventsPerMinute ?? DEFAULT_RATE_LIMIT));
    this.homeDirectory = options.homeDirectory ?? os.homedir();
    this.now = options.now ?? Date.now;
    this.load();
  }

  record(input: DiagnosticEventInput): DiagnosticEvent | undefined {
    const now = this.now();
    const scope = input.scope ? redactString(input.scope.trim(), this.homeDirectory, 128) : undefined;
    if (!this.accept(`${input.source}:${scope ?? ''}`, now)) {
      this.droppedCount += 1;
      if (this.droppedCount % 10 === 1) this.persist();
      return undefined;
    }

    const event: DiagnosticEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(now).toISOString(),
      level: LEVELS.has(input.level) ? input.level : 'error',
      source: SOURCES.has(input.source) ? input.source : 'main',
      scope,
      message: redactString(String(input.message || 'Unknown diagnostic event'), this.homeDirectory, 2000),
      details:
        input.details === undefined
          ? undefined
          : input.source === 'plugin' && typeof input.details === 'string'
            ? '[REDACTED: unstructured plugin data]'
            : redactDiagnosticValue(input.details, this.homeDirectory),
    };
    this.events.push(event);
    this.trim();
    this.persist();
    return event;
  }

  snapshot(): DiagnosticLog {
    return {
      events: JSON.parse(JSON.stringify(this.events)) as DiagnosticEvent[],
      droppedCount: this.droppedCount,
      maxEvents: this.maxEvents,
      maxBytes: this.maxBytes,
    };
  }

  clear(): void {
    this.events = [];
    this.droppedCount = 0;
    this.rateWindows.clear();
    this.persist();
  }

  private accept(key: string, now: number): boolean {
    const current = this.rateWindows.get(key);
    if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
      this.rateWindows.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= this.maxEventsPerMinute) return false;
    current.count += 1;
    return true;
  }

  private trim(): void {
    while (this.events.length > this.maxEvents) {
      this.events.shift();
      this.droppedCount += 1;
    }
    while (this.events.length > 1 && this.serializedSize() > this.maxBytes) {
      this.events.shift();
      this.droppedCount += 1;
    }
    if (this.serializedSize() > this.maxBytes && this.events.length === 1) {
      this.events[0] = {
        ...this.events[0],
        message: this.events[0].message.slice(0, 512),
        details: '[Truncated: diagnostics size limit]',
      };
    }
  }

  private serializedSize(): number {
    return Buffer.byteLength(JSON.stringify(this.fileData()), 'utf8');
  }

  private fileData(): StoredDiagnostics {
    return { schemaVersion: 1, droppedCount: this.droppedCount, events: this.events };
  }

  private load(): void {
    const stored = readJsonFile(this.options.filePath);
    if (!isRecord(stored) || stored.schemaVersion !== 1 || !Array.isArray(stored.events)) return;
    this.droppedCount =
      typeof stored.droppedCount === 'number' && Number.isSafeInteger(stored.droppedCount)
        ? Math.max(0, stored.droppedCount)
        : 0;
    for (const value of stored.events) {
      if (!validStoredEvent(value)) {
        this.droppedCount += 1;
        continue;
      }
      this.events.push({
        id: value.id.slice(0, 128),
        timestamp: value.timestamp,
        level: value.level,
        source: value.source,
        scope: value.scope ? redactString(value.scope, this.homeDirectory, 128) : undefined,
        message: redactString(value.message, this.homeDirectory, 2000),
        details:
          value.details === undefined ? undefined : redactDiagnosticValue(value.details, this.homeDirectory),
      });
    }
    this.trim();
  }

  private persist(): void {
    try {
      writeJsonAtomic(this.options.filePath, this.fileData());
    } catch (error) {
      this.options.onPersistenceError?.(error);
    }
  }
}
