import type {
  HttpRequestParams,
  HttpResponse,
  NetworkInfo,
  PluginSdkResult,
  WebSocketServerEvent,
  WebSocketServerStatus,
} from '@devtoolbox/core';
import { getElectronApi } from '../lib/electron';

export const networkService = {
  isAvailable(): boolean {
    return Boolean(getElectronApi());
  },

  getNetworkInfo(): Promise<NetworkInfo> | undefined {
    return getElectronApi()?.getNetworkInfo();
  },

  httpRequest(params: HttpRequestParams): Promise<PluginSdkResult<HttpResponse>> | undefined {
    return getElectronApi()?.httpRequest(params);
  },

  pingStart(host: string, count?: number): void {
    getElectronApi()?.pingStart(host, count);
  },

  pingStop(): void {
    getElectronApi()?.pingStop();
  },

  onPingData(callback: (data: string) => void): unknown {
    return getElectronApi()?.onPingData(callback);
  },

  onPingError(callback: (error: string) => void): unknown {
    return getElectronApi()?.onPingError(callback);
  },

  onPingDone(callback: () => void): unknown {
    return getElectronApi()?.onPingDone(callback);
  },

  offPingListeners(dataHandler: unknown, errorHandler: unknown, doneHandler: unknown): void {
    getElectronApi()?.offPingListeners(dataHandler, errorHandler, doneHandler);
  },

  tracertStart(host: string, maxHops?: number): void {
    getElectronApi()?.tracertStart(host, maxHops);
  },

  tracertStop(): void {
    getElectronApi()?.tracertStop();
  },

  onTracertData(callback: (data: string) => void): unknown {
    return getElectronApi()?.onTracertData(callback);
  },

  onTracertError(callback: (error: string) => void): unknown {
    return getElectronApi()?.onTracertError(callback);
  },

  onTracertDone(callback: () => void): unknown {
    return getElectronApi()?.onTracertDone(callback);
  },

  offTracertListeners(dataHandler: unknown, errorHandler: unknown, doneHandler: unknown): void {
    getElectronApi()?.offTracertListeners(dataHandler, errorHandler, doneHandler);
  },

  mqttConnect(params: unknown): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.mqttConnect(params);
  },

  mqttDisconnect(id: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.mqttDisconnect(id);
  },

  mqttSubscribe(id: string, topic: string, qos: number): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.mqttSubscribe(id, topic, qos);
  },

  mqttUnsubscribe(id: string, topic: string): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.mqttUnsubscribe(id, topic);
  },

  mqttPublish(
    id: string,
    topic: string,
    payload: string,
    qos: number,
    retain: boolean,
  ): Promise<PluginSdkResult> | undefined {
    return getElectronApi()?.mqttPublish(id, topic, payload, qos, retain);
  },

  onMqttEvent(callback: (id: string, event: string, data?: unknown) => void): unknown {
    return getElectronApi()?.onMqttEvent(callback);
  },

  offMqttEvent(handler: unknown): void {
    getElectronApi()?.offMqttEvent(handler);
  },

  wsServerStatus(): Promise<WebSocketServerStatus> | undefined {
    return getElectronApi()?.wsServerStatus();
  },

  wsServerStart(params: unknown): Promise<WebSocketServerStatus> | undefined {
    return getElectronApi()?.wsServerStart(params);
  },

  wsServerStop(): Promise<WebSocketServerStatus> | undefined {
    return getElectronApi()?.wsServerStop();
  },

  wsServerSend(params: unknown): Promise<boolean> | undefined {
    return getElectronApi()?.wsServerSend(params);
  },

  wsServerKick(params: unknown): Promise<boolean> | undefined {
    return getElectronApi()?.wsServerKick(params);
  },

  wsServerStressStart(params: unknown): Promise<boolean> | undefined {
    return getElectronApi()?.wsServerStressStart(params);
  },

  wsServerStressStop(): Promise<boolean> | undefined {
    return getElectronApi()?.wsServerStressStop();
  },

  onWsServerEvent(callback: (event: WebSocketServerEvent) => void): unknown {
    return getElectronApi()?.onWsServerEvent(callback);
  },

  offWsServerEvent(handler: unknown): void {
    getElectronApi()?.offWsServerEvent(handler);
  },
};
