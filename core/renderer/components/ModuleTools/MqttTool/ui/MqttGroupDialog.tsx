import styles from './MqttTool.module.css';
import { t } from './i18n';

export default function MqttGroupDialog({
  groupName,
  onGroupNameChange,
  onCancel,
  onConfirm,
}: {
  groupName: string;
  onGroupNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <div className={styles.dialogTitle}>{t('addGroup')}</div>
        <label className={styles.dialogLabel}>{t('groupName')}</label>
        <input
          className={styles.dialogInput}
          value={groupName}
          placeholder={t('groupNamePlaceholder')}
          onChange={(event) => onGroupNameChange(event.target.value)}
        />
        <div className={styles.dialogBtns}>
          <button className={styles.dialogBtn} onClick={onCancel}>
            {t('cancel')}
          </button>
          <button className={`${styles.dialogBtn} ${styles.dialogBtnPrimary}`} onClick={onConfirm}>
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
