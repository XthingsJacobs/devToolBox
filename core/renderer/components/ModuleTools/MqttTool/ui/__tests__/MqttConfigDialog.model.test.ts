import { describe, expect, it } from 'vitest';
import { getDefaultMqttConfig } from '../../mqttTypes';
import {
  applyCertFileSelection,
  createMqttClientId,
  isWebSocketProtocol,
  validateMqttConfig,
} from '../MqttConfigDialog.model';

describe('MqttConfigDialog model', () => {
  it('validates required connection fields', () => {
    expect(validateMqttConfig({ name: '', host: 'broker.example.com' })).toBe('nameRequired');
    expect(validateMqttConfig({ name: 'Device', host: '  ' })).toBe('hostRequired');
    expect(validateMqttConfig({ name: 'Device', host: 'broker.example.com' })).toBeNull();
  });

  it('generates stable client id prefix from injected random value', () => {
    expect(createMqttClientId(() => 0.5)).toBe('devtoolbox_8');
  });

  it('detects websocket protocols', () => {
    expect(isWebSocketProtocol('ws://')).toBe(true);
    expect(isWebSocketProtocol('wss://')).toBe(true);
    expect(isWebSocketProtocol('mqtt://')).toBe(false);
    expect(isWebSocketProtocol('mqtts://')).toBe(false);
  });

  it('maps certificate selections to filename and base64 fields', () => {
    const form = getDefaultMqttConfig();
    const selection = { name: 'client.pem', contentB64: 'YWJj' };

    expect(applyCertFileSelection(form, 'clientCert', selection)).toMatchObject({
      clientCert: 'client.pem',
      clientCertDataB64: 'YWJj',
    });
    expect(applyCertFileSelection(form, 'clientKey', selection)).toMatchObject({
      clientKey: 'client.pem',
      clientKeyDataB64: 'YWJj',
    });
    expect(applyCertFileSelection(form, 'caFile', selection)).toMatchObject({
      caFile: 'client.pem',
      caDataB64: 'YWJj',
    });
  });
});
