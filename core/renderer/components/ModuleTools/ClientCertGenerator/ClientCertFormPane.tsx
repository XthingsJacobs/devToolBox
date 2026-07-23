import { VALIDITY_KEYS } from './ClientCertGenerator.model';
import type { ClientCertFieldChange, ClientCertFormState, LocaleText } from './ClientCertGenerator.types';
import { PemField, SelectField } from './ClientCertFields';
import { ClientSubjectFields } from './ClientCertSubjectFields';
import styles from './ClientCertGenerator.module.css';

export function ClientCertFormPane({
  form,
  hasCSR,
  error,
  generating,
  onFieldChange,
  onCountryChange,
  onLoadFile,
  onGenerate,
  mt,
}: {
  form: ClientCertFormState;
  hasCSR: boolean;
  error: string;
  generating: boolean;
  onFieldChange: ClientCertFieldChange;
  onCountryChange: (value: string) => void;
  onLoadFile: (key: 'caCert' | 'caKey' | 'csrInput') => void;
  onGenerate: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.form}>
      <div className={styles.section}>{mt('sectionCA')}</div>
      <PemField
        label={mt('caCertLabel')}
        value={form.caCert}
        placeholder={mt('caCertPlaceholder')}
        onChange={(value) => onFieldChange('caCert', value)}
        onLoad={() => onLoadFile('caCert')}
        mt={mt}
      />
      <PemField
        label={mt('caKeyLabel')}
        value={form.caKey}
        placeholder={mt('caKeyPlaceholder')}
        onChange={(value) => onFieldChange('caKey', value)}
        onLoad={() => onLoadFile('caKey')}
        mt={mt}
      />

      <div className={styles.section}>
        {mt('sectionCSR')} <span className={styles.optional}>{mt('csrHint')}</span>
      </div>
      <PemField
        value={form.csrInput}
        placeholder={mt('csrPlaceholder')}
        onChange={(value) => onFieldChange('csrInput', value)}
        onLoad={() => onLoadFile('csrInput')}
        mt={mt}
      />

      {!hasCSR && (
        <ClientSubjectFields
          form={form}
          onFieldChange={onFieldChange}
          onCountryChange={onCountryChange}
          mt={mt}
        />
      )}

      <SelectField
        label={mt('validity')}
        value={form.validityDays}
        onChange={(value) => onFieldChange('validityDays', value)}
      >
        {VALIDITY_KEYS.map((option) => (
          <option key={option.days} value={option.days}>
            {mt(option.labelKey)}
          </option>
        ))}
      </SelectField>
      {error && <div className={styles.error}>{error}</div>}
      <button className={styles.generateBtn} onClick={onGenerate} disabled={generating}>
        {generating ? mt('generating') : mt('generate')}
      </button>
    </div>
  );
}
