import type { MqttConfig } from '../mqttTypes';

export type MqttConfigSection = 'basic' | 'certs' | 'advanced' | 'lastWill';
export type MqttCertFileField = 'caFile' | 'clientCert' | 'clientKey';
export type MqttConfigValidationKey = 'nameRequired' | 'hostRequired';

export const MQTT_CONFIG_SECTIONS: Record<MqttConfigSection, boolean> = {
  basic: true,
  certs: false,
  advanced: false,
  lastWill: false,
};

export const MQTT_CERT_FILE_FILTERS = [
  { name: 'Certificates', extensions: ['pem', 'crt', 'key', 'cer', 'ca', '*'] },
];

export function createMqttClientId(random = Math.random): string {
  return `devtoolbox_${random().toString(16).slice(2, 10)}`;
}

export function isWebSocketProtocol(protocol: MqttConfig['protocol']): boolean {
  return protocol === 'ws://' || protocol === 'wss://';
}

export function validateMqttConfig(form: Pick<MqttConfig, 'name' | 'host'>): MqttConfigValidationKey | null {
  if (!form.name.trim()) return 'nameRequired';
  if (!form.host.trim()) return 'hostRequired';
  return null;
}

export function applyCertFileSelection(
  form: MqttConfig,
  field: MqttCertFileField,
  selection: { name: string; contentB64: string },
): MqttConfig {
  if (field === 'caFile') return { ...form, caFile: selection.name, caDataB64: selection.contentB64 };
  if (field === 'clientCert') {
    return { ...form, clientCert: selection.name, clientCertDataB64: selection.contentB64 };
  }
  return { ...form, clientKey: selection.name, clientKeyDataB64: selection.contentB64 };
}
