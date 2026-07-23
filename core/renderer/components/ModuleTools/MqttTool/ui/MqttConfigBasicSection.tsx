import type { MqttConfig, MqttGroup } from '../mqttTypes';
import { isWebSocketProtocol, type MqttConfigSection } from './MqttConfigDialog.model';
import { ConfigSection, RequiredMark, SwitchField, TextField } from './MqttConfigDialogFields';
import type { MqttConfigFieldSetter } from './useMqttConfigDialogController';
import { t } from './i18n';
import styles from './MqttConfigDialog.module.css';

export function MqttConfigBasicSection({
  form,
  groups,
  open,
  onToggle,
  setField,
  onRegenClientId,
  onCertTypeChange,
}: {
  form: MqttConfig;
  groups: MqttGroup[];
  open: boolean;
  onToggle: (section: MqttConfigSection) => void;
  setField: MqttConfigFieldSetter;
  onRegenClientId: () => void;
  onCertTypeChange: (value: MqttConfig['certType']) => void;
}) {
  return (
    <ConfigSection title={t('sectionBasic')} section="basic" open={open} onToggle={onToggle}>
      <div className={styles.row}>
        <TextField
          label={
            <>
              <RequiredMark /> {t('name')}
            </>
          }
          value={form.name}
          placeholder={t('namePlaceholder')}
          onChange={(value) => setField('name', value)}
        />
        <GroupSelect value={form.groupId} groups={groups} onChange={(value) => setField('groupId', value)} />
      </div>

      <ServerAddressRow form={form} setField={setField} />
      <ClientIdRow clientId={form.clientId} setField={setField} onRegenClientId={onRegenClientId} />

      <div className={styles.row}>
        <TextField
          label={t('username')}
          value={form.username}
          onChange={(value) => setField('username', value)}
        />
        <TextField
          label={t('password')}
          type="password"
          value={form.password}
          onChange={(value) => setField('password', value)}
        />
      </div>

      <div className={styles.row}>
        <SwitchField
          label={t('sslTls')}
          checked={form.sslEnabled}
          onChange={(value) => setField('sslEnabled', value)}
        />
        <SwitchField
          label={t('sslSecure')}
          checked={form.sslSecure}
          onChange={(value) => setField('sslSecure', value)}
        />
      </div>

      <div className={styles.row}>
        <TextField label={t('alpn')} value={form.alpn} onChange={(value) => setField('alpn', value)} />
      </div>

      <CertTypeField certType={form.certType} onChange={onCertTypeChange} />
    </ConfigSection>
  );
}

function GroupSelect({
  value,
  groups,
  onChange,
}: {
  value?: string;
  groups: MqttGroup[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{t('group')}</label>
      <select
        className={styles.select}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">{t('noGroup')}</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ServerAddressRow({ form, setField }: { form: MqttConfig; setField: MqttConfigFieldSetter }) {
  return (
    <div className={styles.row}>
      <div className={styles.field} style={{ flex: 'none' }}>
        <label className={styles.label}>
          <RequiredMark /> {t('serverAddr')}
        </label>
        <div className={styles.row}>
          <select
            className={styles.select}
            value={form.protocol}
            onChange={(event) => setField('protocol', event.target.value as MqttConfig['protocol'])}
            style={{ width: 120, flex: 'none' }}
          >
            <option value="mqtts://">mqtts://</option>
            <option value="mqtt://">mqtt://</option>
            <option value="wss://">wss://</option>
            <option value="ws://">ws://</option>
          </select>
          <input
            className={styles.input}
            value={form.host}
            onChange={(event) => setField('host', event.target.value)}
          />
          <input
            className={styles.input}
            type="number"
            value={form.port}
            onChange={(event) => setField('port', Number(event.target.value))}
            style={{ width: 80, flex: 'none' }}
          />
          {isWebSocketProtocol(form.protocol) && (
            <input
              className={styles.input}
              value={form.path}
              onChange={(event) => setField('path', event.target.value)}
              placeholder="/mqtt"
              style={{ width: 120, flex: 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ClientIdRow({
  clientId,
  setField,
  onRegenClientId,
}: {
  clientId: string;
  setField: MqttConfigFieldSetter;
  onRegenClientId: () => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.field}>
        <label className={styles.label}>{t('clientId')}</label>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={clientId}
            onChange={(event) => setField('clientId', event.target.value)}
          />
          <button
            className={styles.regenBtn}
            onClick={onRegenClientId}
            type="button"
            title={t('clientIdRegen')}
          >
            ↻
          </button>
        </div>
      </div>
    </div>
  );
}

function CertTypeField({
  certType,
  onChange,
}: {
  certType: MqttConfig['certType'];
  onChange: (value: MqttConfig['certType']) => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.field}>
        <label className={styles.label}>{t('certType')}</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input type="radio" checked={certType === 'ca-signed'} onChange={() => onChange('ca-signed')} />
            {t('certCaSigned')}
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              checked={certType === 'self-signed'}
              onChange={() => onChange('self-signed')}
            />
            {t('certSelfSigned')}
          </label>
        </div>
      </div>
    </div>
  );
}
