import type { RefObject } from 'react';
import SafeHtml from '../../../SafeHtml';
import type { MqttSubscription, PublishPayloadFormat } from './MqttWorkspace.types';
import styles from './MqttWorkspace.module.css';
import { t } from './i18n';

interface MqttPublishPanelProps {
  height: number;
  topic: string;
  format: PublishPayloadFormat;
  payload: string;
  qos: MqttSubscription['qos'];
  retain: boolean;
  formatWarning: string;
  isConnected: boolean;
  isJsonFormat: boolean;
  jsonHighlightHtml: string;
  textareaRef: RefObject<HTMLTextAreaElement>;
  highlightRef: RefObject<HTMLDivElement>;
  onTopicChange: (value: string) => void;
  onFormatChange: (value: PublishPayloadFormat) => void;
  onQosChange: (value: MqttSubscription['qos']) => void;
  onRetainChange: (value: boolean) => void;
  onPayloadChange: (value: string) => void;
  onTextareaScroll: () => void;
  onPublish: () => void;
}

export default function MqttPublishPanel({
  height,
  topic,
  format,
  payload,
  qos,
  retain,
  formatWarning,
  isConnected,
  isJsonFormat,
  jsonHighlightHtml,
  textareaRef,
  highlightRef,
  onTopicChange,
  onFormatChange,
  onQosChange,
  onRetainChange,
  onPayloadChange,
  onTextareaScroll,
  onPublish,
}: MqttPublishPanelProps) {
  return (
    <div className={styles.publishBar} style={{ height }}>
      <div className={styles.pubRow}>
        <input
          className={styles.topicInput}
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder={t('pubTopicPlaceholder')}
        />
        <select
          className={styles.qosSelect}
          value={format}
          onChange={(e) => onFormatChange(e.target.value as PublishPayloadFormat)}
        >
          <option value="json">JSON</option>
          <option value="plaintext">Plaintext</option>
          <option value="base64">Base64</option>
          <option value="hex">Hex</option>
        </select>
        <select
          className={styles.qosSelect}
          value={qos}
          onChange={(e) => onQosChange(Number(e.target.value) as MqttSubscription['qos'])}
        >
          <option value={0}>QoS 0</option>
          <option value={1}>QoS 1</option>
          <option value={2}>QoS 2</option>
        </select>
        <label className={styles.retainCheck}>
          <input type="checkbox" checked={retain} onChange={(e) => onRetainChange(e.target.checked)} />
          {t('retain')}
        </label>
      </div>
      <div className={styles.pubTextareaWrap}>
        {isJsonFormat && jsonHighlightHtml && (
          <SafeHtml
            ref={highlightRef}
            className={styles.pubHighlight}
            html={jsonHighlightHtml}
            profile="syntax"
            aria-hidden="true"
          />
        )}
        <textarea
          ref={textareaRef}
          className={`${styles.pubTextarea}${formatWarning ? ` ${styles.pubTextareaWarn}` : ''}${isJsonFormat && jsonHighlightHtml ? ` ${styles.pubTextareaTransparent}` : ''}`}
          value={payload}
          onChange={(e) => onPayloadChange(e.target.value)}
          onScroll={onTextareaScroll}
          placeholder={t('pubPayloadPlaceholder')}
          rows={3}
          spellCheck={false}
        />
        {formatWarning && <span className={styles.pubWarn}>{formatWarning}</span>}
        <button
          className={`${styles.smallBtn} ${styles.pubSendBtn}`}
          onClick={onPublish}
          disabled={!isConnected || !topic.trim()}
        >
          {t('publish')}
        </button>
      </div>
    </div>
  );
}
