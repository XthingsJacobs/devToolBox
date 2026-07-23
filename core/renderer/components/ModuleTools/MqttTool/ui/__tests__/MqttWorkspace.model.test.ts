import { describe, expect, it } from 'vitest';
import { getDefaultMqttConfig } from '../../mqttTypes';
import {
  appendMqttMessages,
  buildMqttConnectParams,
  convertPublishPayload,
  detectPayloadFormat,
  filterTopicTemplates,
  formatJsonHighlight,
  isMqttBusyStatus,
  mqttStatusLabelKey,
  searchMessageIds,
  serializeMqttMessages,
} from '../MqttWorkspace.model';
import type { MqttMessage } from '../MqttWorkspace.types';

function message(overrides: Partial<MqttMessage>): MqttMessage {
  return {
    id: 1,
    dir: 'recv',
    topic: 'devices/status',
    payload: 'online',
    qos: 0,
    retain: false,
    time: '10:00:00',
    ...overrides,
  };
}

describe('MqttWorkspace model', () => {
  it('detects JSON, printable base64, binary hex, and plain text payloads', () => {
    expect(detectPayloadFormat('{"ok":true,"count":2}')).toEqual({
      format: 'json',
      decoded: '{\n  "ok": true,\n  "count": 2\n}',
    });
    expect(detectPayloadFormat('aGVsbG8=')).toEqual({ format: 'base64', decoded: 'hello' });
    expect(detectPayloadFormat(`hello${String.fromCharCode(1)}`)).toEqual({
      format: 'hex',
      decoded: '68 65 6c 6c 6f 01',
    });
    expect(detectPayloadFormat('hello')).toEqual({ format: 'text' });
  });

  it('highlights valid JSON and returns empty output for invalid JSON', () => {
    expect(formatJsonHighlight('{"name":"sensor","ok":true}')).toContain('class="json-key"');
    expect(formatJsonHighlight('{"name":')).toBe('');
  });

  it('converts publish payloads between JSON, base64, hex, and plaintext', () => {
    expect(convertPublishPayload('{"a":1}', 'json', 'base64')).toEqual({ payload: 'eyJhIjoxfQ==' });
    expect(convertPublishPayload('eyJhIjoxfQ==', 'base64', 'json')).toEqual({
      payload: '{\n  "a": 1\n}',
    });
    expect(convertPublishPayload('41 42', 'hex', 'plaintext')).toEqual({ payload: 'AB' });
    expect(convertPublishPayload('not-json', 'plaintext', 'json')).toEqual({
      payload: 'not-json',
      warningKey: 'jsonInvalid',
    });
  });

  it('filters topic templates case-insensitively', () => {
    expect(filterTopicTemplates('presence')).toEqual([
      '$aws/events/presence/connected/clientId',
      '$aws/events/presence/disconnected/clientId',
    ]);
    expect(filterTopicTemplates('')).toContain('utec/+/+/<UUID>/#');
  });

  it('caps buffered messages and searches topic, payload, and decoded content', () => {
    const capped = appendMqttMessages(
      [message({ id: 1 }), message({ id: 2 })],
      [message({ id: 3 }), message({ id: 4 })],
      3,
    );
    expect(capped.map((item) => item.id)).toEqual([2, 3, 4]);
    expect(
      searchMessageIds(
        [
          message({ id: 1, topic: 'devices/a', payload: 'raw' }),
          message({ id: 2, topic: 'events/b', payload: 'other', decoded: 'needle' }),
        ],
        'NEEDLE',
      ),
    ).toEqual([2]);
  });

  it('serializes message logs and maps config fields into connect params', () => {
    expect(
      serializeMqttMessages([
        message({ dir: 'sent', topic: 'cmd', payload: 'turn-on', qos: 1, retain: true }),
        message({ topic: 'state', payload: '{"ok":true}', decoded: '{\n  "ok": true\n}', format: 'json' }),
      ]),
    ).toContain('[10:00:00] [SENT] [cmd] QoS:1 Retain\nturn-on');

    const config = {
      ...getDefaultMqttConfig(),
      id: 'mqtt-test',
      host: 'broker.example.com',
      port: 8883,
      username: 'user',
      password: 'secret',
      caFileToken: 'not-sent',
    };
    expect(buildMqttConnectParams(config)).toMatchObject({
      id: 'mqtt-test',
      host: 'broker.example.com',
      port: 8883,
      username: 'user',
      password: 'secret',
    });
    expect(buildMqttConnectParams(config)).not.toHaveProperty('caFileToken');
  });

  it('maps MQTT status display metadata', () => {
    expect(mqttStatusLabelKey('connected')).toBe('connected');
    expect(mqttStatusLabelKey('connecting')).toBe('connecting');
    expect(mqttStatusLabelKey('error')).toBe('connError');
    expect(mqttStatusLabelKey('disconnected')).toBe('disconnected');
    expect(isMqttBusyStatus('connected')).toBe(true);
    expect(isMqttBusyStatus('connecting')).toBe(true);
    expect(isMqttBusyStatus('disconnected')).toBe(false);
  });
});
