import { useCallback, useMemo, useRef, useState } from 'react';
import { mqttPublish } from '../sdk';
import { t } from './i18n';
import { convertPublishPayload, formatJsonHighlight, nextMqttMessageId } from './MqttWorkspace.model';
import type { ConnStatus, MqttMessage, MqttSubscription, PublishPayloadFormat } from './MqttWorkspace.types';

export function useMqttPublisher({
  configId,
  status,
  appendMessage,
}: {
  configId: string;
  status: ConnStatus;
  appendMessage: (message: MqttMessage) => void;
}) {
  const [pubTopic, setPubTopic] = useState('');
  const [pubPayload, setPubPayload] = useState('');
  const [pubQos, setPubQos] = useState<MqttSubscription['qos']>(0);
  const [pubRetain, setPubRetain] = useState(false);
  const [pubFormat, setPubFormat] = useState<PublishPayloadFormat>('json');
  const [pubFormatWarn, setPubFormatWarn] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const isJsonFormat = pubFormat === 'json';
  const jsonHighlightHtml = useMemo(() => {
    if (!isJsonFormat || !pubPayload) return '';
    return formatJsonHighlight(pubPayload);
  }, [isJsonFormat, pubPayload]);

  const handleTextareaScroll = useCallback(() => {
    if (!textareaRef.current || !highlightRef.current) return;
    highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, []);

  const handlePublish = useCallback(async () => {
    const topic = pubTopic.trim();
    if (!topic || status !== 'connected') return;
    await mqttPublish(configId, topic, pubPayload, pubQos, pubRetain);
    appendMessage({
      id: nextMqttMessageId(),
      dir: 'sent',
      topic,
      payload: pubPayload,
      qos: pubQos,
      retain: pubRetain,
      time: new Date().toLocaleTimeString(),
    });
  }, [appendMessage, configId, pubPayload, pubQos, pubRetain, pubTopic, status]);

  const handleFormatChange = useCallback(
    (newFormat: PublishPayloadFormat) => {
      const converted = convertPublishPayload(pubPayload, pubFormat, newFormat);
      setPubPayload(converted.payload);
      setPubFormatWarn(converted.warningKey ? t(converted.warningKey) : '');
      setPubFormat(newFormat);
    },
    [pubFormat, pubPayload],
  );

  return {
    topic: pubTopic,
    format: pubFormat,
    payload: pubPayload,
    qos: pubQos,
    retain: pubRetain,
    formatWarning: pubFormatWarn,
    isConnected: status === 'connected',
    isJsonFormat,
    jsonHighlightHtml,
    textareaRef,
    highlightRef,
    onTopicChange: setPubTopic,
    onFormatChange: handleFormatChange,
    onQosChange: setPubQos,
    onRetainChange: setPubRetain,
    onPayloadChange: (value: string) => {
      setPubPayload(value);
      setPubFormatWarn('');
    },
    onTextareaScroll: handleTextareaScroll,
    onPublish: () => void handlePublish(),
  };
}
