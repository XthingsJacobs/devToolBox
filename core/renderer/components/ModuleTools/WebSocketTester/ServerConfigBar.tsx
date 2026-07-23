import styles from './ServerPanel.module.css';
import type { ServerFormState, ServerStatus } from './ServerPanel.types';

export function ServerConfigBar({
  form,
  status,
  clientsCount,
  running,
  startDisabled,
  onFieldChange,
  onStart,
  onStop,
}: {
  form: ServerFormState;
  status: ServerStatus;
  clientsCount: number;
  running: boolean;
  startDisabled: boolean;
  onFieldChange: <K extends keyof ServerFormState>(key: K, value: ServerFormState[K]) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className={styles.inputBar}>
      <div className={styles.label}>Host</div>
      <input
        className={styles.textInput}
        value={form.host}
        onChange={(e) => onFieldChange('host', e.target.value)}
      />
      <div className={styles.label}>Port</div>
      <input
        className={styles.textInput}
        value={form.port}
        onChange={(e) => onFieldChange('port', e.target.value)}
      />
      <div className={styles.label}>Path</div>
      <input
        className={`${styles.textInput} ${styles.wideInput}`}
        value={form.path}
        onChange={(e) => onFieldChange('path', e.target.value)}
      />

      <div className={styles.label}>TLS</div>
      <select
        className={styles.select}
        value={form.tls ? '1' : '0'}
        onChange={(e) => onFieldChange('tls', e.target.value === '1')}
      >
        <option value="0">Off</option>
        <option value="1">On</option>
      </select>

      <button
        className={`${styles.actionBtn} ${styles.primaryBtn}`}
        onClick={onStart}
        disabled={startDisabled}
      >
        Start
      </button>
      <button className={`${styles.actionBtn} ${styles.stopBtn}`} onClick={onStop} disabled={!running}>
        Stop
      </button>

      <span className={styles.badge}>{running ? `Running: ${status.url}` : 'Stopped'}</span>
      <span className={styles.badge}>Clients: {clientsCount}</span>
      <span className={styles.badge}>
        Sent: {status.stats.totalSent} · Recv: {status.stats.totalRecv}
      </span>
      <span className={styles.badge}>Protocol debugging</span>
    </div>
  );
}

export function ServerTlsBar({
  certLoaded,
  keyLoaded,
  running,
  onLoadCert,
  onLoadKey,
}: {
  certLoaded: boolean;
  keyLoaded: boolean;
  running: boolean;
  onLoadCert: () => void;
  onLoadKey: () => void;
}) {
  return (
    <div className={styles.inputBar}>
      <button className={styles.actionBtn} onClick={onLoadCert} disabled={running}>
        Load Cert
      </button>
      <button className={styles.actionBtn} onClick={onLoadKey} disabled={running}>
        Load Key
      </button>
      <span className={styles.hint}>
        {certLoaded ? 'Cert loaded' : 'Cert missing'} · {keyLoaded ? 'Key loaded' : 'Key missing'}
      </span>
    </div>
  );
}

export function ServerErrorBar({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className={styles.inputBar}>
      <div className={styles.hint} style={{ color: 'var(--color-error, #e74c3c)' }}>
        {error}
      </div>
    </div>
  );
}
