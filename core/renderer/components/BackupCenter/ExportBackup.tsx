import { useMemo, useState } from 'react';
import styles from './BackupCenter.module.css';

function collectLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('devtoolbox_') || k === 'devtools.moduleUsage.v1') {
        const v = localStorage.getItem(k);
        if (typeof v === 'string') out[k] = v;
      }
    }
  } catch {
    return out;
  }
  return out;
}

export default function ExportBackup() {
  const [bindToDevice, setBindToDevice] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [okPath, setOkPath] = useState('');
  const [err, setErr] = useState('');

  const canExport = useMemo(() => {
    if (!usePassword) return true;
    return password.trim().length > 0;
  }, [password, usePassword]);

  const handleExport = async () => {
    setErr('');
    setOkPath('');
    setBusy(true);
    try {
      const res = await window.electronAPI?.backupExport({
        bindToDevice,
        password: usePassword ? password : undefined,
        localStorage: collectLocalStorage(),
      });
      if (!res?.success) {
        setErr(res?.error ?? 'export_failed');
        return;
      }
      setOkPath(res.filePath ?? '');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap} aria-label="Export">
      <div className={styles.card}>
        <div className={styles.row}>
          <label className={styles.check}>
            <input type="checkbox" checked={bindToDevice} onChange={(e) => setBindToDevice(e.target.checked)} />
            Encrypt (this device only)
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.check}>
            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} />
            Encrypt with password
          </label>
        </div>
        {usePassword && (
          <div className={styles.row}>
            <input
              className={styles.input}
              type="password"
              value={password}
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        <div className={styles.hint}>The backup includes app data and selected local settings.</div>
      </div>

      <div className={styles.card}>
        <div className={`${styles.row} ${styles.rowBetween}`}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!canExport || busy}
            onClick={() => void handleExport()}
          >
            {busy ? 'Exporting...' : 'Export...'}
          </button>
          <div className={styles.row}>
            {okPath && <span className={styles.msgOk}>Saved</span>}
            {err && <span className={styles.msgErr}>{err}</span>}
          </div>
        </div>
        {okPath && <div className={styles.filePath}>{okPath}</div>}
      </div>
    </div>
  );
}
