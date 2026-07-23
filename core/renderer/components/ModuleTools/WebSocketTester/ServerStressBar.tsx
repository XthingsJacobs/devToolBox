import styles from './ServerPanel.module.css';

export function ServerStressBar({
  running,
  stressEnabled,
  intervalMs,
  payloadBytes,
  onIntervalChange,
  onPayloadBytesChange,
  onToggleStress,
}: {
  running: boolean;
  stressEnabled: boolean;
  intervalMs: string;
  payloadBytes: string;
  onIntervalChange: (value: string) => void;
  onPayloadBytesChange: (value: string) => void;
  onToggleStress: () => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.label}>Stress</div>
      <input
        className={styles.textInput}
        value={intervalMs}
        onChange={(e) => onIntervalChange(e.target.value)}
        placeholder="interval ms"
      />
      <input
        className={styles.textInput}
        value={payloadBytes}
        onChange={(e) => onPayloadBytesChange(e.target.value)}
        placeholder="payload bytes"
      />
      <button className={styles.actionBtn} onClick={onToggleStress} disabled={!running}>
        {stressEnabled ? 'Stop' : 'Start'}
      </button>
      <span className={styles.hint}>Broadcast a fixed-size payload to all clients</span>
    </div>
  );
}
