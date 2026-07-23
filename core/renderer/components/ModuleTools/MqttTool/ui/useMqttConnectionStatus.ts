import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { MqttConfig } from '../mqttTypes';
import { mqttConnect, mqttDisconnect, mqttSubscribe, onSdkEvent } from '../sdk';
import {
  buildMqttConnectParams,
  detectPayloadFormat,
  isMqttBusyStatus,
  mqttStatusLabelKey,
  nextMqttMessageId,
} from './MqttWorkspace.model';
import type { ConnStatus, MqttMessage, MqttSubscription } from './MqttWorkspace.types';
import { t } from './i18n';
import { useState } from 'react';

export function useMqttConnectionStatus({
  config,
  externalStatus,
  subsRef,
  appendMessage,
}: {
  config: MqttConfig;
  externalStatus?: ConnStatus;
  subsRef: MutableRefObject<MqttSubscription[]>;
  appendMessage: (message: MqttMessage) => void;
}) {
  const [status, setStatus] = useState<ConnStatus>('disconnected');
  const disconnectingRef = useRef(false);

  useEffect(() => {
    if (externalStatus) setStatus(externalStatus);
  }, [externalStatus]);

  useEffect(() => {
    const offConnected = onSdkEvent<{ id: string }>('mqtt.connected', (data) => {
      if (data?.id !== config.id) return;
      setStatus('connected');
      disconnectingRef.current = false;
      subsRef.current.forEach((subscription) => {
        if (subscription.enabled) void mqttSubscribe(config.id, subscription.topic, subscription.qos);
      });
    });
    const offMessage = onSdkEvent<{
      id: string;
      topic: string;
      payload: string;
      qos: number;
      retain: boolean;
    }>('mqtt.message', (data) => {
      if (data?.id !== config.id) return;
      const detected = detectPayloadFormat(data.payload);
      appendMessage({
        id: nextMqttMessageId(),
        dir: 'recv',
        topic: data.topic,
        payload: data.payload,
        qos: data.qos ?? 0,
        retain: Boolean(data.retain),
        time: new Date().toLocaleTimeString(),
        format: detected.format,
        decoded: detected.decoded,
      });
    });
    const offError = onSdkEvent<{ id: string; message: string }>('mqtt.error', (data) => {
      if (data?.id !== config.id) return;
      setStatus('error');
    });
    const offClose = onSdkEvent<{ id: string }>('mqtt.close', (data) => {
      if (data?.id !== config.id) return;
      if (!disconnectingRef.current) setStatus('disconnected');
    });
    const offReconnect = onSdkEvent<{ id: string }>('mqtt.reconnect', (data) => {
      if (data?.id !== config.id) return;
      setStatus('connecting');
    });
    return () => {
      offConnected();
      offMessage();
      offError();
      offClose();
      offReconnect();
    };
  }, [appendMessage, config.id, subsRef]);

  const handleConnect = useCallback(async () => {
    disconnectingRef.current = false;
    setStatus('connecting');
    await mqttConnect(buildMqttConnectParams(config));
  }, [config]);

  const handleDisconnect = useCallback(async () => {
    disconnectingRef.current = true;
    await mqttDisconnect(config.id);
    setStatus('disconnected');
  }, [config.id]);

  return {
    status,
    statusLabel: t(mqttStatusLabelKey(status)),
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    busy: isMqttBusyStatus(status),
    onConnect: () => void handleConnect(),
    onDisconnect: () => void handleDisconnect(),
  };
}
