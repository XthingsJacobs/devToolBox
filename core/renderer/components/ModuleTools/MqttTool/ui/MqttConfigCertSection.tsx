import { VscFolder } from 'react-icons/vsc';
import type { MqttConfig } from '../mqttTypes';
import type { MqttCertFileField, MqttConfigSection } from './MqttConfigDialog.model';
import { ConfigSection } from './MqttConfigDialogFields';
import { t } from './i18n';
import styles from './MqttConfigDialog.module.css';

export function MqttConfigCertSection({
  form,
  open,
  onToggle,
  onFileSelect,
}: {
  form: MqttConfig;
  open: boolean;
  onToggle: (section: MqttConfigSection) => void;
  onFileSelect: (field: MqttCertFileField) => void;
}) {
  return (
    <ConfigSection title={t('sectionCerts')} section="certs" open={open} onToggle={onToggle}>
      <CertFileField label={t('caFile')} value={form.caFile} field="caFile" onFileSelect={onFileSelect} />
      <CertFileField
        label={t('clientCert')}
        value={form.clientCert}
        field="clientCert"
        onFileSelect={onFileSelect}
      />
      <CertFileField
        label={t('clientKey')}
        value={form.clientKey}
        field="clientKey"
        onFileSelect={onFileSelect}
      />
    </ConfigSection>
  );
}

function CertFileField({
  label,
  value,
  field,
  onFileSelect,
}: {
  label: string;
  value: string;
  field: MqttCertFileField;
  onFileSelect: (field: MqttCertFileField) => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.field}>
        <label className={styles.label}>{label}</label>
        <div className={styles.fileInputWrap}>
          <input className={styles.fileInput} value={value} readOnly />
          <button
            className={styles.fileIconBtn}
            onClick={() => onFileSelect(field)}
            type="button"
            title={t('selectFile')}
            aria-label={t('selectFile')}
          >
            <VscFolder />
          </button>
        </div>
      </div>
    </div>
  );
}
