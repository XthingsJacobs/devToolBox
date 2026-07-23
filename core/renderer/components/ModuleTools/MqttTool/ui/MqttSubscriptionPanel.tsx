import type { MqttSubscription } from './MqttWorkspace.types';
import styles from './MqttWorkspace.module.css';
import { t } from './i18n';

export type HoverSubscription = { topic: string; top: number; left: number } | null;

interface MqttSubscriptionPanelProps {
  leftWidth: number;
  subscriptions: MqttSubscription[];
  hoverSub: HoverSubscription;
  onHoverSubChange: (value: HoverSubscription) => void;
  onAddSubscription: () => void;
  onToggleSubscription: (topic: string, enabled: boolean) => void;
  onUnsubscribe: (topic: string) => void;
}

export default function MqttSubscriptionPanel({
  leftWidth,
  subscriptions,
  hoverSub,
  onHoverSubChange,
  onAddSubscription,
  onToggleSubscription,
  onUnsubscribe,
}: MqttSubscriptionPanelProps) {
  return (
    <div className={styles.leftPanel} style={{ width: leftWidth, minWidth: leftWidth }}>
      <div className={styles.panelSection}>
        <div className={styles.panelHeader}>
          {t('subscriptions')}
          <button className={styles.subAddBtn} onClick={onAddSubscription} title={t('addSubscription')}>
            ＋
          </button>
        </div>
        <div className={styles.panelBody}>
          {subscriptions.length > 0 ? (
            <div className={styles.subList}>
              {subscriptions.map((subscription) => (
                <div
                  key={subscription.topic}
                  className={`${styles.subItem}${!subscription.enabled ? ` ${styles.subItemDisabled}` : ''}`}
                  onMouseEnter={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    onHoverSubChange({
                      topic: subscription.topic,
                      top: rect.bottom + 4,
                      left: rect.left,
                    });
                  }}
                  onMouseLeave={() => onHoverSubChange(null)}
                >
                  <input
                    type="checkbox"
                    className={styles.subCheck}
                    checked={subscription.enabled}
                    onChange={(e) => onToggleSubscription(subscription.topic, e.target.checked)}
                  />
                  <span className={styles.subTopic}>{subscription.topic}</span>
                  <span className={styles.subQos}>QoS {subscription.qos}</span>
                  <button
                    className={styles.unsubBtn}
                    onClick={() => onUnsubscribe(subscription.topic)}
                    title={t('unsubscribe')}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {hoverSub && (
                <div className={styles.subTooltip} style={{ top: hoverSub.top, left: hoverSub.left }}>
                  {hoverSub.topic}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.subEmpty}>{t('noSubscriptions')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
