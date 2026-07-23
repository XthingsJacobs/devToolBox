import type { RefObject } from 'react';
import type { MqttSubscription } from './MqttWorkspace.types';
import styles from './MqttWorkspace.module.css';
import { t } from './i18n';

interface MqttSubscriptionDialogProps {
  topic: string;
  qos: MqttSubscription['qos'];
  showTopicDropdown: boolean;
  filteredTemplates: string[];
  inputRef: RefObject<HTMLInputElement>;
  onTopicChange: (value: string) => void;
  onQosChange: (value: MqttSubscription['qos']) => void;
  onDropdownChange: (value: boolean | ((previous: boolean) => boolean)) => void;
  onSubscribe: () => void;
  onClose: () => void;
}

export default function MqttSubscriptionDialog({
  topic,
  qos,
  showTopicDropdown,
  filteredTemplates,
  inputRef,
  onTopicChange,
  onQosChange,
  onDropdownChange,
  onSubscribe,
  onClose,
}: MqttSubscriptionDialogProps) {
  return (
    <div className={styles.subDialogOverlay} onClick={onClose}>
      <div className={styles.subDialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.subDialogTitle}>{t('addSubscription')}</div>
        <div className={styles.subDialogField}>
          <label className={styles.subDialogLabel}>{t('subTopic')}</label>
          <div className={styles.comboboxWrap}>
            <input
              ref={inputRef}
              className={styles.subDialogInput}
              value={topic}
              onChange={(e) => {
                onTopicChange(e.target.value);
                onDropdownChange(e.target.value.trim().length > 0);
              }}
              onBlur={() => setTimeout(() => onDropdownChange(false), 150)}
              placeholder={t('subTopicPlaceholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && topic.trim()) {
                  onSubscribe();
                  onClose();
                }
                if (e.key === 'Escape') onDropdownChange(false);
              }}
            />
            <button
              className={styles.comboboxToggle}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                onDropdownChange((value) => !value);
                inputRef.current?.focus();
              }}
              aria-label={t('selectTemplate')}
            >
              ▾
            </button>
            {showTopicDropdown && filteredTemplates.length > 0 && (
              <div className={styles.comboboxDropdown}>
                <div className={styles.comboboxDropdownLabel}>{t('topicTemplates')}</div>
                {filteredTemplates.map((template) => (
                  <div
                    key={template}
                    className={styles.comboboxOption}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onTopicChange(template);
                      onDropdownChange(false);
                    }}
                  >
                    {template}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={styles.subDialogField}>
          <label className={styles.subDialogLabel}>QoS</label>
          <select
            className={styles.subDialogSelect}
            value={qos}
            onChange={(e) => onQosChange(Number(e.target.value) as MqttSubscription['qos'])}
          >
            <option value={0}>QoS 0</option>
            <option value={1}>QoS 1</option>
            <option value={2}>QoS 2</option>
          </select>
        </div>
        <div className={styles.subDialogBtns}>
          <button className={styles.subDialogBtn} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            className={`${styles.subDialogBtn} ${styles.subDialogBtnPrimary}`}
            disabled={!topic.trim()}
            onClick={() => {
              onSubscribe();
              onClose();
            }}
          >
            {t('subscribe')}
          </button>
        </div>
      </div>
    </div>
  );
}
