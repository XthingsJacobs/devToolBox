import type { ReactNode } from 'react';
import { VscChevronRight } from 'react-icons/vsc';
import type { MqttConfigSection } from './MqttConfigDialog.model';
import styles from './MqttConfigDialog.module.css';

export function ConfigSection({
  title,
  section,
  open,
  onToggle,
  children,
}: {
  title: string;
  section: MqttConfigSection;
  open: boolean;
  onToggle: (section: MqttConfigSection) => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader} onClick={() => onToggle(section)}>
        <span className={`${styles.sectionArrow} ${open ? styles.sectionArrowOpen : ''}`}>
          <VscChevronRight />
        </span>
        {title}
      </div>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

export function TextField({
  label,
  value,
  placeholder,
  type = 'text',
  onChange,
}: {
  label: ReactNode;
  value: string | number;
  placeholder?: string;
  type?: 'text' | 'password' | 'number';
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input
        className={styles.input}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <div className={styles.row}>
        <input
          className={styles.input}
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

export function NumberFieldWithSuffix({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <div className={styles.row}>
        <input
          className={styles.input}
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className={styles.suffix}>{suffix}</span>
      </div>
    </div>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.switchRow}>
        <label className={styles.label}>{label}</label>
        <label className={styles.switch}>
          <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
          <span className={styles.slider} />
        </label>
      </div>
    </div>
  );
}

export function RequiredMark() {
  return <span className={styles.required}>*</span>;
}
