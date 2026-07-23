import type { MqttConfig, MqttGroup } from '../mqttTypes';
import styles from './MqttConfigDialog.module.css';
import { VscChromeClose } from 'react-icons/vsc';
import { t } from './i18n';
import { MqttConfigAdvancedSection } from './MqttConfigAdvancedSection';
import { MqttConfigBasicSection } from './MqttConfigBasicSection';
import { MqttConfigCertSection } from './MqttConfigCertSection';
import { MqttConfigLastWillSection } from './MqttConfigLastWillSection';
import { useMqttConfigDialogController } from './useMqttConfigDialogController';

interface Props {
  config?: MqttConfig;
  groups?: MqttGroup[];
  onSave: (config: MqttConfig) => void;
  onClose: () => void;
}

export default function MqttConfigDialog({ config, groups = [], onSave, onClose }: Props) {
  const {
    form,
    error,
    openSections,
    setField,
    toggleSection,
    handleSave,
    regenClientId,
    handleFileSelect,
    handleCertTypeChange,
  } = useMqttConfigDialogController({ config, onSave });
  const isEdit = Boolean(config);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <span>{isEdit ? t('editClient') : t('addClient')}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <VscChromeClose />
          </button>
        </div>
        <div className={styles.body}>
          <MqttConfigBasicSection
            form={form}
            groups={groups}
            open={openSections.basic}
            onToggle={toggleSection}
            setField={setField}
            onRegenClientId={regenClientId}
            onCertTypeChange={handleCertTypeChange}
          />
          <MqttConfigCertSection
            form={form}
            open={openSections.certs}
            onToggle={toggleSection}
            onFileSelect={(field) => void handleFileSelect(field)}
          />
          <MqttConfigAdvancedSection
            form={form}
            open={openSections.advanced}
            onToggle={toggleSection}
            setField={setField}
          />
          <MqttConfigLastWillSection
            form={form}
            open={openSections.lastWill}
            onToggle={toggleSection}
            setField={setField}
          />
          {error && <div className={styles.error}>{error}</div>}
        </div>
        <div className={styles.footer}>
          <button className={styles.btn} onClick={onClose}>
            {t('cancel')}
          </button>
          <button className={styles.btnPrimary} onClick={handleSave}>
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
