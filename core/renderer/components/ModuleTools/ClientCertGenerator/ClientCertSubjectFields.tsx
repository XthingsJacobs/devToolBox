import { KEY_SIZES } from './ClientCertGenerator.model';
import type { ClientCertFieldChange, ClientCertFormState, LocaleText } from './ClientCertGenerator.types';
import { SelectField, TextField } from './ClientCertFields';
import styles from './ClientCertGenerator.module.css';

export function ClientSubjectFields({
  form,
  onFieldChange,
  onCountryChange,
  mt,
}: {
  form: ClientCertFormState;
  onFieldChange: ClientCertFieldChange;
  onCountryChange: (value: string) => void;
  mt: LocaleText;
}) {
  return (
    <>
      <div className={styles.section}>{mt('sectionClient')}</div>
      <TextField
        label={
          <>
            Common Name (CN) <span className={styles.optional}>{mt('optional')}</span>
          </>
        }
        value={form.commonName}
        onChange={(value) => onFieldChange('commonName', value)}
        placeholder="client.example.com"
      />
      <TextField
        label={
          <>
            Organization (O) <span className={styles.optional}>{mt('optional')}</span>
          </>
        }
        value={form.organization}
        onChange={(value) => onFieldChange('organization', value)}
        placeholder={mt('placeholderOrg')}
      />
      <TextField
        label={
          <>
            Organizational Unit (OU) <span className={styles.optional}>{mt('optional')}</span>
          </>
        }
        value={form.organizationalUnit}
        onChange={(value) => onFieldChange('organizationalUnit', value)}
        placeholder={mt('placeholderOU')}
      />
      <TextField
        label={
          <>
            Country (C) <span className={styles.optional}>{mt('optionalCountry')}</span>
          </>
        }
        value={form.country}
        onChange={onCountryChange}
        placeholder="CN"
        maxLength={2}
      />
      <TextField
        label={
          <>
            State (ST) <span className={styles.optional}>{mt('optional')}</span>
          </>
        }
        value={form.state}
        onChange={(value) => onFieldChange('state', value)}
        placeholder={mt('placeholderState')}
      />
      <TextField
        label={
          <>
            Locality (L) <span className={styles.optional}>{mt('optional')}</span>
          </>
        }
        value={form.locality}
        onChange={(value) => onFieldChange('locality', value)}
        placeholder={mt('placeholderCity')}
      />
      <SelectField
        label={mt('keySize')}
        value={form.keySize}
        onChange={(value) => onFieldChange('keySize', value)}
      >
        {KEY_SIZES.map((size) => (
          <option key={size} value={size}>
            {size} bit
          </option>
        ))}
      </SelectField>
    </>
  );
}
