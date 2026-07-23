export type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type PublishPayloadFormat = 'json' | 'plaintext' | 'base64' | 'hex';

export interface MqttMessage {
  id: number;
  dir: 'recv' | 'sent';
  topic: string;
  payload: string;
  qos: number;
  retain: boolean;
  time: string;
  format?: 'json' | 'base64' | 'hex' | 'text';
  decoded?: string;
}

export interface MqttSubscription {
  topic: string;
  qos: 0 | 1 | 2;
  enabled: boolean;
}
