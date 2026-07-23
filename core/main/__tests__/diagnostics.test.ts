import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DiagnosticStore, redactDiagnosticValue } from '../diagnostics';

const temporaryDirectories: string[] = [];

function diagnosticsFile(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'devtoolbox-diagnostics-'));
  temporaryDirectories.push(directory);
  return path.join(directory, 'events.json');
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('diagnostic redaction', () => {
  it('removes sensitive fields, credentials, private keys, and the user home path', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const redacted = redactDiagnosticValue(
      {
        password: 'do-not-store',
        nested: {
          authorization: 'Bearer secret-token',
          url: 'https://user:pass@example.com/path?token=secret',
          stack: 'at run (/Users/example/project/app.ts:10:2)',
        },
        content: 'private file contents',
        key: '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----',
        circular,
      },
      '/Users/example',
    ) as Record<string, unknown>;

    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.content).toBe('[REDACTED]');
    expect(redacted.key).toBe('[REDACTED PRIVATE KEY]');
    expect(redacted.circular).toEqual({ self: '[Circular]' });
    expect(redacted.nested).toEqual({
      authorization: '[REDACTED]',
      url: 'https://[REDACTED]@example.com/path?token=[REDACTED]',
      stack: 'at run (~/project/app.ts:10:2)',
    });
  });
});

describe('DiagnosticStore', () => {
  it('persists only the newest bounded events and tracks discarded entries', () => {
    const filePath = diagnosticsFile();
    let now = Date.parse('2026-07-20T00:00:00.000Z');
    const store = new DiagnosticStore({
      filePath,
      maxEvents: 3,
      now: () => now++,
      homeDirectory: '/Users/example',
    });

    for (let index = 1; index <= 4; index += 1) {
      store.record({ level: 'info', source: 'renderer', message: `event ${index}` });
    }

    expect(store.snapshot()).toMatchObject({
      droppedCount: 1,
      maxEvents: 3,
      events: [{ message: 'event 2' }, { message: 'event 3' }, { message: 'event 4' }],
    });
    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);

    const restored = new DiagnosticStore({ filePath, maxEvents: 3, homeDirectory: '/Users/example' });
    expect(restored.snapshot()).toMatchObject({
      droppedCount: 1,
      events: [{ message: 'event 2' }, { message: 'event 3' }, { message: 'event 4' }],
    });
  });

  it('rate-limits one source scope without blocking later windows', () => {
    const filePath = diagnosticsFile();
    let now = 1000;
    const store = new DiagnosticStore({
      filePath,
      maxEventsPerMinute: 2,
      now: () => now,
    });

    expect(
      store.record({
        level: 'warn',
        source: 'plugin',
        scope: 'market-test',
        message: 'one',
        details: 'unstructured plugin payload',
      }),
    ).toMatchObject({ details: '[REDACTED: unstructured plugin data]' });
    expect(
      store.record({ level: 'warn', source: 'plugin', scope: 'market-test', message: 'two' }),
    ).toBeDefined();
    expect(
      store.record({ level: 'warn', source: 'plugin', scope: 'market-test', message: 'three' }),
    ).toBeUndefined();
    expect(store.snapshot()).toMatchObject({
      droppedCount: 1,
      events: [{ message: 'one' }, { message: 'two' }],
    });

    now += 60_000;
    expect(
      store.record({ level: 'warn', source: 'plugin', scope: 'market-test', message: 'four' }),
    ).toBeDefined();
    expect(store.snapshot().events).toHaveLength(3);
  });

  it('truncates an oversized event and can clear the persisted log', () => {
    const filePath = diagnosticsFile();
    const store = new DiagnosticStore({ filePath, maxBytes: 1024 });

    store.record({
      level: 'error',
      source: 'main',
      message: 'large event',
      details: Object.fromEntries(
        Array.from({ length: 30 }, (_, index) => [`field-${index}`, 'x'.repeat(1000)]),
      ),
    });

    expect(store.snapshot().events[0].details).toBe('[Truncated: diagnostics size limit]');
    expect(fs.statSync(filePath).size).toBeLessThanOrEqual(1024);

    store.clear();
    expect(store.snapshot()).toMatchObject({ events: [], droppedCount: 0 });
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toMatchObject({ events: [], droppedCount: 0 });
  });
});
