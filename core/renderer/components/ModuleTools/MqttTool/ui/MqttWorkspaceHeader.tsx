import type { MqttConfig } from '../mqttTypes';
import type { ConnStatus } from './MqttWorkspace.types';
import styles from './MqttWorkspace.module.css';
import { t } from './i18n';

export function MqttWorkspaceHeader({
  config,
  status,
  statusLabel,
  busy,
  isConnected,
  isConnecting,
  onEdit,
  onCopy,
  onDelete,
  onConnect,
  onDisconnect,
}: {
  config: MqttConfig;
  status: ConnStatus;
  statusLabel: string;
  busy: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  onEdit?: (id: string) => void;
  onCopy?: (id: string) => void;
  onDelete?: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className={styles.topBar}>
      <div className={styles.connInfo}>
        <span className={`${styles.statusDot} ${styles[status]}`} />
        {statusLabel} — {config.protocol}
        {config.host}:{config.port}
      </div>
      {onDelete && !busy && (
        <button className={`${styles.connBtn} ${styles.deleteBtn}`} onClick={onDelete}>
          {t('delete')}
        </button>
      )}
      {onCopy && (
        <button className={`${styles.connBtn} ${styles.copyBtn}`} onClick={() => onCopy(config.id)}>
          {t('copy')}
        </button>
      )}
      {onEdit && !busy && (
        <button className={`${styles.connBtn} ${styles.editBtn}`} onClick={() => onEdit(config.id)}>
          {t('edit')}
        </button>
      )}
      {isConnected || isConnecting ? (
        <button className={`${styles.connBtn} ${styles.disconnect}`} onClick={onDisconnect}>
          {t('disconnect')}
        </button>
      ) : (
        <button className={`${styles.connBtn} ${styles.connect}`} onClick={onConnect}>
          {t('connect')}
        </button>
      )}
    </div>
  );
}
