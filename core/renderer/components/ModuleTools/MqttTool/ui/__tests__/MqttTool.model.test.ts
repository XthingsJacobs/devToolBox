import { describe, expect, it } from 'vitest';
import type { MqttConfig } from '../../mqttTypes';
import {
  buildDefaultOpenGroups,
  createMqttGroup,
  duplicateMqttConfig,
  groupMqttConfigs,
  nextActiveConfigIdAfterDelete,
  ungroupedMqttConfigs,
} from '../MqttTool.model';

function config(id: string, groupId?: string): MqttConfig {
  return {
    id,
    name: id,
    groupId,
    protocol: 'mqtts://',
    host: 'broker.example.com',
    port: 8883,
    path: '/mqtt',
    clientId: `client_${id}`,
    username: '',
    password: '',
    sslEnabled: true,
    sslSecure: true,
    alpn: '',
    certType: 'ca-signed',
    caFile: '',
    clientCert: '',
    clientKey: '',
    mqttVersion: '3.1.1',
    connectTimeout: 10,
    keepAlive: 60,
    autoReconnect: true,
    reconnectPeriod: 4000,
    cleanStart: true,
    sessionExpiry: 0,
    lastWillTopic: '',
    lastWillQos: 0,
    lastWillRetain: false,
    lastWillMessage: '',
    lastWillFormat: 'plaintext',
  };
}

describe('MqttTool model', () => {
  it('groups configs and collects ungrouped configs', () => {
    const configs = [config('a'), config('b', 'g1'), config('c', 'g1'), config('d', 'g2')];

    expect(ungroupedMqttConfigs(configs).map((item) => item.id)).toEqual(['a']);
    expect(
      Object.fromEntries(
        Object.entries(groupMqttConfigs(configs)).map(([key, value]) => [key, value.map((item) => item.id)]),
      ),
    ).toEqual({
      g1: ['b', 'c'],
      g2: ['d'],
    });
  });

  it('builds default group open state', () => {
    expect(
      buildDefaultOpenGroups([
        { id: 'g1', name: 'One' },
        { id: 'g2', name: 'Two' },
      ]),
    ).toEqual({ g1: true, g2: true });
  });

  it('duplicates config using a fresh id and client id', () => {
    const copy = duplicateMqttConfig(config('a'), { ...config('new'), clientId: 'fresh' });

    expect(copy).toMatchObject({ id: 'new', name: 'a (copy)', clientId: 'fresh' });
    expect(copy.host).toBe('broker.example.com');
  });

  it('creates groups from non-empty names', () => {
    expect(
      createMqttGroup(
        '  ',
        () => 1,
        () => 0.1,
      ),
    ).toBeNull();
    expect(
      createMqttGroup(
        ' Devices ',
        () => 1,
        () => 0.1,
      ),
    ).toEqual({ id: 'g_1_3lll', name: 'Devices' });
  });

  it('selects next active connection after deletion', () => {
    const configs = [config('a'), config('b')];

    expect(nextActiveConfigIdAfterDelete(configs, 'a', 'b')).toBe('b');
    expect(nextActiveConfigIdAfterDelete(configs, 'a', 'a')).toBe('b');
    expect(nextActiveConfigIdAfterDelete([config('a')], 'a', 'a')).toBeNull();
  });
});
