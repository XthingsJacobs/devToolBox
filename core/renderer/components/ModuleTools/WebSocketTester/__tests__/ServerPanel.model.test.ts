import { describe, expect, it } from 'vitest';
import {
  appendServerLog,
  buildServerSendParams,
  buildServerStartParams,
  canStartServer,
  clampStressOptions,
  classifyServerLog,
  isValidServerPort,
  nowText,
} from '../ServerPanel.model';

describe('ServerPanel model', () => {
  it('formats timestamps and classifies log lines', () => {
    expect(nowText(new Date(2026, 0, 1, 2, 3, 4, 5))).toBe('02:03:04.005');
    expect(classifyServerLog('info', 'recv (abc): hi')).toBe('recv');
    expect(classifyServerLog('info', 'send broadcast: hi')).toBe('send');
    expect(classifyServerLog('error', 'anything')).toBe('error');
    expect(classifyServerLog('info', 'client connected')).toBe('system');
  });

  it('caps logs at the configured max length', () => {
    const logs = appendServerLog(
      [
        { ts: '1', level: 'info', kind: 'system', text: 'old' },
        { ts: '2', level: 'info', kind: 'system', text: 'older' },
      ],
      'info',
      'recv: next',
      '3',
      2,
    );

    expect(logs).toEqual([
      { ts: '2', level: 'info', kind: 'system', text: 'older' },
      { ts: '3', level: 'info', kind: 'recv', text: 'recv: next' },
    ]);
  });

  it('validates start readiness', () => {
    expect(isValidServerPort('8080')).toBe(true);
    expect(isValidServerPort('0')).toBe(false);
    expect(isValidServerPort('70000')).toBe(false);
    expect(
      canStartServer({
        apiAvailable: true,
        running: false,
        port: '8080',
        tls: false,
        certPem: '',
        keyPem: '',
      }),
    ).toBe(true);
    expect(
      canStartServer({
        apiAvailable: true,
        running: false,
        port: '8080',
        tls: true,
        certPem: 'cert',
        keyPem: '',
      }),
    ).toBe(false);
  });

  it('builds server start and send params', () => {
    expect(
      buildServerStartParams({
        host: ' 127.0.0.1 ',
        port: '8080',
        path: ' ',
        tls: true,
        certPem: ' cert ',
        keyPem: '',
      }),
    ).toEqual({
      host: '127.0.0.1',
      port: 8080,
      path: '/',
      tls: true,
      certPem: 'cert',
      keyPem: undefined,
    });
    expect(buildServerSendParams('broadcast', 'hello')).toEqual({ broadcast: true, data: 'hello' });
    expect(buildServerSendParams('client-1', 'hello')).toEqual({ clientId: 'client-1', data: 'hello' });
  });

  it('clamps stress options', () => {
    expect(clampStressOptions('1', '0')).toEqual({ intervalMs: 10, payloadBytes: 64 });
    expect(clampStressOptions('70000', '999999')).toEqual({ intervalMs: 60000, payloadBytes: 65536 });
    expect(clampStressOptions('bad', 'bad')).toEqual({ intervalMs: 1000, payloadBytes: 64 });
  });
});
