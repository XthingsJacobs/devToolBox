import type { RefObject } from 'react';
import SafeHtml from '../../../SafeHtml';
import { highlightJson } from './MqttWorkspace.model';
import type { MqttMessage } from './MqttWorkspace.types';
import styles from './MqttWorkspace.module.css';
import { t } from './i18n';

interface MqttMessageConsoleProps {
  messages: MqttMessage[];
  orderedMessages: MqttMessage[];
  showSearch: boolean;
  search: string;
  searchMatches: number[];
  searchMatchIdx: number;
  msgListRef: RefObject<HTMLDivElement>;
  msgSearchRef: RefObject<HTMLInputElement>;
  onSearchChange: (value: string) => void;
  onSearchPrev: () => void;
  onSearchNext: () => void;
  onSearchClose: () => void;
  onSaveMessages: () => void;
  onClearMessages: () => void;
}

function CopyPayloadButton({ payload }: { payload: string }) {
  return (
    <span
      className={styles.msgCopyIcon}
      onClick={() => void navigator.clipboard.writeText(payload)}
      title={t('copyPayload')}
    >
      <svg viewBox="0 0 24 24">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
      </svg>
    </span>
  );
}

function MqttMessagePayload({ message }: { message: MqttMessage }) {
  if (message.format === 'json' && message.decoded) {
    return (
      <div className={`${styles.msgPayload} ${styles.msgPayloadJson}`}>
        <CopyPayloadButton payload={message.decoded} />
        <SafeHtml html={highlightJson(message.decoded)} profile="syntax" />
      </div>
    );
  }

  if (message.format === 'base64' && message.decoded) {
    return (
      <div className={styles.msgPayload}>
        <CopyPayloadButton payload={message.decoded} />
        <div>{message.decoded}</div>
        <div>
          {t('originalBase64')}: {message.payload}
        </div>
      </div>
    );
  }

  if (message.format === 'hex' && message.decoded) {
    return (
      <div className={`${styles.msgPayload} ${styles.msgPayloadHex}`}>
        <CopyPayloadButton payload={message.decoded} />
        {message.decoded}
      </div>
    );
  }

  return (
    <div className={styles.msgPayload}>
      <CopyPayloadButton payload={message.payload} />
      {message.payload}
    </div>
  );
}

export default function MqttMessageConsole({
  messages,
  orderedMessages,
  showSearch,
  search,
  searchMatches,
  searchMatchIdx,
  msgListRef,
  msgSearchRef,
  onSearchChange,
  onSearchPrev,
  onSearchNext,
  onSearchClose,
  onSaveMessages,
  onClearMessages,
}: MqttMessageConsoleProps) {
  return (
    <>
      <div className={styles.msgToolbar}>
        <span className={styles.msgCount}>
          {t('messages')} ({messages.length})
        </span>
        <button className={styles.smallBtn} onClick={onSaveMessages} disabled={messages.length === 0}>
          {t('saveMessages')}
        </button>
        <button className={styles.smallBtn} onClick={onClearMessages} disabled={messages.length === 0}>
          {t('clearMessages')}
        </button>
      </div>
      {showSearch && (
        <div className={styles.msgSearchBar}>
          <input
            ref={msgSearchRef}
            className={styles.msgSearchInput}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onSearchClose();
              if (e.key === 'Enter') {
                if (e.shiftKey) onSearchPrev();
                else onSearchNext();
              }
            }}
          />
          {search && (
            <span className={styles.msgSearchCount}>
              {searchMatches.length > 0 ? `${searchMatchIdx + 1}/${searchMatches.length}` : `0/0`}
            </span>
          )}
          <button
            className={styles.msgSearchNavBtn}
            onClick={onSearchPrev}
            disabled={searchMatches.length === 0}
            title={t('searchPrev')}
          >
            ▲
          </button>
          <button
            className={styles.msgSearchNavBtn}
            onClick={onSearchNext}
            disabled={searchMatches.length === 0}
            title={t('searchNext')}
          >
            ▼
          </button>
          <button className={styles.msgSearchClose} onClick={onSearchClose}>
            ✕
          </button>
        </div>
      )}
      <div className={styles.msgList} ref={msgListRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyMsg}>{t('noMessages')}</div>
        ) : (
          orderedMessages.map((message) => {
            const isMatch = Boolean(search && searchMatches.includes(message.id));
            const isCurrent = isMatch && searchMatches[searchMatchIdx] === message.id;
            const isSent = message.dir === 'sent';
            return (
              <div
                key={message.id}
                data-msgid={message.id}
                className={`${styles.msgRow} ${isSent ? styles.msgRowSent : styles.msgRowRecv}`}
              >
                <div
                  className={`${styles.msgBubble} ${isSent ? styles.msgBubbleSent : styles.msgBubbleRecv}${isCurrent ? ` ${styles.msgItemCurrent}` : isMatch ? ` ${styles.msgItemMatch}` : ''}`}
                >
                  <div className={styles.msgMeta}>
                    <span className={styles.msgTopic}>Topic: {message.topic}</span>
                    <span className={styles.msgQos}>QoS: {message.qos}</span>
                    {message.format && message.format !== 'text' && (
                      <span className={styles.msgFormat}>{message.format.toUpperCase()}</span>
                    )}
                  </div>
                  <MqttMessagePayload message={message} />
                  <span className={styles.msgTime}>{message.time}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
