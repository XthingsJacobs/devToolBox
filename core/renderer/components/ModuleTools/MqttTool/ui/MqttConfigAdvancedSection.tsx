import type { MqttConfig } from '../mqttTypes';
import type { MqttConfigSection } from './MqttConfigDialog.model';
import { ConfigSection, NumberFieldWithSuffix, SwitchField } from './MqttConfigDialogFields';
import type { MqttConfigFieldSetter } from './useMqttConfigDialogController';
import { t } from './i18n';
import styles from './MqttConfigDialog.module.css';

export function MqttConfigAdvancedSection({
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
    <ConfigSection title={t('sectionAdvanced')} section="advanced" open={open} onToggle={onToggle}>
      <div className={styles.row}>
        <MqttVersionField value={form.mqttVersion} onChange={(value) => setField('mqttVersion', value)} />
      </div>

      <div className={styles.row}>
        <NumberFieldWithSuffix
          label={t('connectTimeout')}
          value={form.connectTimeout}
          suffix={t('seconds')}
          onChange={(value) => setField('connectTimeout', value)}
        />
        <NumberFieldWithSuffix
          label={t('keepAlive')}
          value={form.keepAlive}
          suffix={t('seconds')}
          onChange={(value) => setField('keepAlive', value)}
        />
      </div>

      <div className={styles.row}>
        <SwitchField
          label={t('autoReconnect')}
          checked={form.autoReconnect}
          onChange={(value) => setField('autoReconnect', value)}
        />
        <NumberFieldWithSuffix
          label={t('reconnectPeriod')}
          value={form.reconnectPeriod}
          suffix={t('milliseconds')}
          onChange={(value) => setField('reconnectPeriod', value)}
        />
      </div>

      <div className={styles.row}>
        <SwitchField
          label={t('cleanStart')}
          checked={form.cleanStart}
          onChange={(value) => setField('cleanStart', value)}
        />
        <NumberFieldWithSuffix
          label={t('sessionExpiry')}
          value={form.sessionExpiry}
          suffix={t('seconds')}
          onChange={(value) => setField('sessionExpiry', value)}
        />
      </div>
    </ConfigSection>
  );
}

function MqttVersionField({
  value,
  onChange,
}: {
  value: MqttConfig['mqttVersion'];
  onChange: (value: MqttConfig['mqttVersion']) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{t('mqttVersion')}</label>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value as MqttConfig['mqttVersion'])}
      >
        <option value="5.0">5.0</option>
        <option value="3.1.1">3.1.1</option>
        <option value="3.1">3.1</option>
      </select>
    </div>
  );
}
