import type { ReactNode } from 'react';
import type { LocaleText } from './ClientCertGenerator.types';
import styles from './ClientCertGenerator.module.css';

export function PemField({
  label,
  value,
  placeholder,
  onChange,
  onLoad,
  mt,
}: {
  label?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onLoad: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.fileRow}>
        <textarea
          className={styles.textarea}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
        />
        <button className={styles.loadBtn} onClick={onLoad}>
          {mt('import')}
        </button>
      </div>
    </div>
  );
}

export function TextField({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  label: ReactNode;
  value: string;
  placeholder: string;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        maxLength={maxLength}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {children}
      </select>
    </div>
  );
}
