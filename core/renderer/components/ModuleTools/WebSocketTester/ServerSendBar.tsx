import styles from './ServerPanel.module.css';
import type { ClientInfo } from './ServerPanel.types';

export function ServerSendBar({
  clients,
  running,
  selectedClientId,
  broadcastText,
  onSelectedClientChange,
  onBroadcastTextChange,
  onSend,
  onKick,
  onClear,
}: {
  clients: ClientInfo[];
  running: boolean;
  selectedClientId: string;
  broadcastText: string;
  onSelectedClientChange: (value: string) => void;
  onBroadcastTextChange: (value: string) => void;
  onSend: () => void;
  onKick: () => void;
  onClear: () => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.label}>Target</div>
      <select
        className={styles.select}
        value={selectedClientId}
        onChange={(e) => onSelectedClientChange(e.target.value)}
      >
        <option value="broadcast">Broadcast</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.remote} · {client.id.slice(0, 6)}
          </option>
        ))}
      </select>
      <input
        className={`${styles.textInput} ${styles.wideInput}`}
        value={broadcastText}
        onChange={(e) => onBroadcastTextChange(e.target.value)}
        placeholder="Payload (text/JSON)"
      />
      <button className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={onSend} disabled={!running}>
        Send Frame
      </button>
      <button
        className={styles.actionBtn}
        onClick={onKick}
        disabled={!running || selectedClientId === 'broadcast'}
      >
        Kick
      </button>
      <button className={styles.actionBtn} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
