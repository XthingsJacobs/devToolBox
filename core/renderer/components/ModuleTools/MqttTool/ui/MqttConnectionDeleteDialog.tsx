import styles from './MqttTool.module.css';
import { t } from './i18n';

export default function MqttConnectionDeleteDialog({
  connectionName,
  onCancel,
  onConfirm,
}: {
  connectionName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <div className={styles.dialogTitle}>{t('deleteConfirmTitle')}</div>
        <div className={styles.deleteConfirmMsg}>{t('deleteConfirmMsg', { name: connectionName })}</div>
        <div className={styles.dialogBtns}>
          <button className={styles.dialogBtn} onClick={onCancel}>
            {t('cancel')}
          </button>
          <button className={`${styles.dialogBtn} ${styles.dialogBtnPrimary}`} onClick={onConfirm}>
            {t('delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
