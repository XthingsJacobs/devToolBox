import type { MqttConfig } from '../mqttTypes';
import type { ConnStatus, MqttMessage, PublishPayloadFormat } from './MqttWorkspace.types';

export const MAX_MESSAGES = 2000;

export const MQTT_TOPIC_TEMPLATES = [
  '$aws/events/presence/connected/clientId',
  '$aws/events/presence/disconnected/clientId',
  '$aws/events/subscriptions/subscribed/clientId',
  '$aws/events/subscriptions/unsubscribed/clientId',
  'utec/+/+/<UUID>/#',
  'utec/+/+/FF:FF:FF:<UUID>/#',
] as const;

export type PublishFormatWarningKey = 'jsonInvalid' | 'base64Invalid' | 'hexInvalid';
export type MqttStatusLabelKey = 'connected' | 'connecting' | 'connError' | 'disconnected';

let msgIdCounter = 0;

export function nextMqttMessageId(): number {
  msgIdCounter += 1;
  return msgIdCounter;
}

export function highlightJson(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(?:\\.|[^"\\])*")(\s*:)/g, '<span class="json-key">$1</span>$2')
    .replace(/:\s*("(?:\\.|[^"\\])*")(?=\s*[,\n\r\]}])/g, (match, str) =>
      match.replace(str, `<span class="json-str">${str}</span>`),
    )
    .replace(/:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)(?=\s*[,\n\r\]}])/g, (match, num) =>
      match.replace(num, `<span class="json-num">${num}</span>`),
    )
    .replace(/:\s*(true|false)(?=\s*[,\n\r\]}])/g, (match, val) =>
      match.replace(val, `<span class="json-bool">${val}</span>`),
    )
    .replace(/:\s*(null)(?=\s*[,\n\r\]}])/g, (match, val) =>
      match.replace(val, `<span class="json-null">${val}</span>`),
    );
}

export function detectPayloadFormat(payload: string): { format: MqttMessage['format']; decoded?: string } {
  const trimmed = payload.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      const obj = JSON.parse(trimmed) as unknown;
      return { format: 'json', decoded: JSON.stringify(obj, null, 2) };
    } catch {
      void 0;
    }
  }

  const hasBinary = Array.from(payload).some((c) => {
    const code = c.charCodeAt(0);
    return (code >= 0 && code <= 8) || (code >= 14 && code <= 31) || (code >= 127 && code <= 159);
  });
  if (hasBinary) {
    const hex = Array.from(payload, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    return { format: 'hex', decoded: hex };
  }

  if (trimmed.length >= 8 && /^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length % 4 === 0) {
    try {
      const raw = atob(trimmed);
      const printable = /^[\x20-\x7E\t\n\r]*$/.test(raw);
      if (printable && raw.length > 0) return { format: 'base64', decoded: raw };
    } catch {
      void 0;
    }
  }

  return { format: 'text' };
}

export function filterTopicTemplates(query: string, templates = MQTT_TOPIC_TEMPLATES): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...templates];
  return templates.filter((template) => template.toLowerCase().includes(trimmed));
}

export function formatJsonHighlight(payload: string): string {
  try {
    JSON.parse(payload);
    return `${highlightJson(payload)}\n`;
  } catch {
    return '';
  }
}

export function convertPublishPayload(
  payload: string,
  fromFormat: PublishPayloadFormat,
  toFormat: PublishPayloadFormat,
): { payload: string; warningKey?: PublishFormatWarningKey } {
  const text = payload.trim();
  if (!text) return { payload };

  let raw = text;
  try {
    switch (fromFormat) {
      case 'base64':
        raw = atob(text);
        break;
      case 'hex':
        raw = text.replace(/\s/g, '').replace(/../g, (hex) => String.fromCharCode(parseInt(hex, 16)));
        break;
      default:
        break;
    }
  } catch {
    raw = text;
  }

  try {
    switch (toFormat) {
      case 'json': {
        try {
          const obj = JSON.parse(raw) as unknown;
          return { payload: JSON.stringify(obj, null, 2) };
        } catch {
          return { payload: raw, warningKey: 'jsonInvalid' };
        }
      }
      case 'base64':
        return { payload: btoa(raw) };
      case 'hex':
        return {
          payload: Array.from(raw, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '),
        };
      default:
        return { payload: raw };
    }
  } catch {
    return { payload: raw, warningKey: 'base64Invalid' };
  }
}

export function appendMqttMessages(
  previous: MqttMessage[],
  pending: MqttMessage[],
  maxMessages = MAX_MESSAGES,
): MqttMessage[] {
  const next = [...previous, ...pending];
  if (next.length <= maxMessages) return next;
  return next.slice(next.length - maxMessages);
}

export function searchMessageIds(messages: MqttMessage[], query: string): number[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return messages
    .filter(
      (message) =>
        message.topic.toLowerCase().includes(q) ||
        message.payload.toLowerCase().includes(q) ||
        Boolean(message.decoded?.toLowerCase().includes(q)),
    )
    .map((message) => message.id);
}

export function serializeMqttMessages(messages: MqttMessage[]): string {
  const lines = messages.map((message) => {
    const dir = message.dir === 'recv' ? 'RECV' : 'SENT';
    const content = message.decoded ?? message.payload;
    const format = message.format && message.format !== 'text' ? ` (${message.format.toUpperCase()})` : '';
    return `[${message.time}] [${dir}] [${message.topic}] QoS:${message.qos}${
      message.retain ? ' Retain' : ''
    }${format}\n${content}`;
  });
  return lines.join('\n\n');
}

export function mqttMessagesExportFileName(connectionName: string, date = new Date()): string {
  return `mqtt-messages-${connectionName}-${date.toISOString().slice(0, 10)}.txt`;
}

export function mqttStatusLabelKey(status: ConnStatus): MqttStatusLabelKey {
  if (status === 'connected') return 'connected';
  if (status === 'connecting') return 'connecting';
  if (status === 'error') return 'connError';
  return 'disconnected';
}

export function isMqttBusyStatus(status: ConnStatus): boolean {
  return status === 'connected' || status === 'connecting';
}

export function buildMqttConnectParams(config: MqttConfig): Record<string, unknown> {
  return {
    id: config.id,
    protocol: config.protocol,
    host: config.host,
    port: config.port,
    path: config.path,
    clientId: config.clientId,
    username: config.username,
    password: config.password,
    sslEnabled: config.sslEnabled,
    sslSecure: config.sslSecure,
    alpn: config.alpn,
    certType: config.certType,
    caFile: config.caFile,
    clientCert: config.clientCert,
    clientKey: config.clientKey,
    caPem: config.caPem,
    clientCertPem: config.clientCertPem,
    clientKeyPem: config.clientKeyPem,
    caDataB64: config.caDataB64,
    clientCertDataB64: config.clientCertDataB64,
    clientKeyDataB64: config.clientKeyDataB64,
    mqttVersion: config.mqttVersion,
    connectTimeout: config.connectTimeout,
    keepAlive: config.keepAlive,
    autoReconnect: config.autoReconnect,
    reconnectPeriod: config.reconnectPeriod,
    cleanStart: config.cleanStart,
    sessionExpiry: config.sessionExpiry,
    lastWillTopic: config.lastWillTopic,
    lastWillQos: config.lastWillQos,
    lastWillRetain: config.lastWillRetain,
    lastWillMessage: config.lastWillMessage,
  };
}
