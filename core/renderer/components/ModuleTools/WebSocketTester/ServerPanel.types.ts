import type { WebSocketServerClient, WebSocketServerEvent, WebSocketServerStatus } from '@devtoolbox/core';

export type ClientInfo = WebSocketServerClient;
export type ServerStatus = WebSocketServerStatus;
export type WsServerEvent = WebSocketServerEvent;

export type LogKind = 'system' | 'send' | 'recv' | 'error';
export type LogItem = { ts: string; level: 'info' | 'error'; kind: LogKind; text: string };

export interface ServerFormState {
  host: string;
  port: string;
  path: string;
  tls: boolean;
  certPem: string;
  keyPem: string;
}

export interface WsServerBridge {
  isAvailable: () => boolean;
  status: () => Promise<ServerStatus | undefined>;
  start: (params: unknown) => Promise<ServerStatus | undefined>;
  stop: () => Promise<ServerStatus | undefined>;
  send: (params: unknown) => Promise<boolean | undefined>;
  kick: (params: unknown) => Promise<boolean | undefined>;
  stressStart: (params: unknown) => Promise<boolean | undefined>;
  stressStop: () => Promise<boolean | undefined>;
  openPem: () => Promise<string>;
  onEvent: (callback: (event: WsServerEvent) => void) => unknown;
  offEvent: (handler: unknown) => void;
}
