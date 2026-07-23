import styles from './MqttWorkspace.module.css';
import { t } from './i18n';

interface MqttDeleteConfirmDialogProps {
  connectionName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function MqttDeleteConfirmDialog({
  connectionName,
  onCancel,
  onConfirm,
}: MqttDeleteConfirmDialogProps) {
  return (
    <div className={styles.subDialogOverlay} onClick={onCancel}>
      <div className={styles.subDialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.subDialogTitle}>{t('deleteConfirmTitle')}</div>
        <div className={styles.deleteConfirmMsg}>{t('deleteConfirmMsg', { name: connectionName })}</div>
        <div className={styles.subDialogBtns}>
          <button className={styles.subDialogBtn} onClick={onCancel}>
            {t('cancel')}
          </button>
          <button className={`${styles.subDialogBtn} ${styles.deleteConfirmBtn}`} onClick={onConfirm}>
            {t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
