import { VscCopy } from 'react-icons/vsc';
import styles from './IpCalculator.module.css';

export function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      className={styles.copyBtn}
      disabled={!value}
      onClick={() => void navigator.clipboard.writeText(value)}
      aria-label="Copy"
    >
      <VscCopy />
    </button>
  );
}

export function ResultRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className={styles.row}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value || '-'}</div>
      {copy ? <CopyButton value={value} /> : <span />}
    </div>
  );
}
