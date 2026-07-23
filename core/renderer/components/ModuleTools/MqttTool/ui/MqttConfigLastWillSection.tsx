import type { MqttConfig } from '../mqttTypes';
import type { MqttConfigSection } from './MqttConfigDialog.model';
import { ConfigSection, SwitchField, TextField } from './MqttConfigDialogFields';
import type { MqttConfigFieldSetter } from './useMqttConfigDialogController';
import { t } from './i18n';
import styles from './MqttConfigDialog.module.css';

export function MqttConfigLastWillSection({
  form,
  open,
  onToggle,
  setField,
}: {
  form: MqttConfig;
  open: boolean;
  onToggle: (section: MqttConfigSection) => void;
  setField: MqttConfigFieldSetter;
}) {
  return (
    <ConfigSection title={t('sectionLastWill')} section="lastWill" open={open} onToggle={onToggle}>
      <div className={styles.row}>
        <TextField
          label={t('lastWillTopic')}
          value={form.lastWillTopic}
          onChange={(value) => setField('lastWillTopic', value)}
        />
      </div>
      <div className={styles.row}>
        <LastWillQosField value={form.lastWillQos} onChange={(value) => setField('lastWillQos', value)} />
        <SwitchField
          label={t('lastWillRetain')}
          checked={form.lastWillRetain}
          onChange={(value) => setField('lastWillRetain', value)}
        />
      </div>
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>{t('lastWillMessage')}</label>
          <textarea
            className={styles.textarea}
            value={form.lastWillMessage}
            onChange={(event) => setField('lastWillMessage', event.target.value)}
          />
        </div>
      </div>
    </ConfigSection>
  );
}

function LastWillQosField({
  value,
  onChange,
}: {
  value: MqttConfig['lastWillQos'];
  onChange: (value: MqttConfig['lastWillQos']) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{t('lastWillQos')}</label>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as MqttConfig['lastWillQos'])}
      >
        <option value={0}>QoS 0</option>
        <option value={1}>QoS 1</option>
        <option value={2}>QoS 2</option>
      </select>
    </div>
  );
}
