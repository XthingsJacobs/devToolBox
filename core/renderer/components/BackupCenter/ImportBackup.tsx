import { useMemo, useState } from 'react';
import styles from './BackupCenter.module.css';

type BackupHeader = { schemaVersion?: number; encryption?: { mode?: string; layers?: { mode?: string }[] } };
type DtbxInfo = { version: number; modes: string[]; needsPassword: boolean };

function b64ToBytes(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToText(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes);
}

function parseDtbxBinary(bytes: Uint8Array): DtbxInfo | null {
  if (bytes.length < 6) return null;
  if (bytes[0] !== 0x44 || bytes[1] !== 0x54 || bytes[2] !== 0x42 || bytes[3] !== 0x58) return null;
  const version = bytes[4];
  const layerCount = bytes[5];
  let o = 6;
  const modes: string[] = [];
  for (let i = 0; i < layerCount; i += 1) {
    if (o + 1 + 16 + 12 + 16 > bytes.length) return null;
    const m = bytes[o];
    const mode = m === 0 ? 'builtin' : m === 1 ? 'device' : m === 2 ? 'password' : null;
    if (!mode) return null;
    modes.push(mode);
    o += 1 + 16 + 12 + 16;
  }
  return { version, modes, needsPassword: modes.includes('password') };
}

function parseHeader(content: string): BackupHeader | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as BackupHeader;
  } catch {
    return null;
  }
}

function applyLocalStorage(snapshot: Record<string, string>) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('devtoolbox_') || k === 'devtools.moduleUsage.v1') keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    Object.entries(snapshot).forEach(([k, v]) => {
      localStorage.setItem(k, String(v ?? ''));
    });
  } catch {
    return;
  }
}

export default function ImportBackup() {
  const [filePath, setFilePath] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState('');

  const fileBytes = useMemo(() => (fileBase64 ? b64ToBytes(fileBase64) : null), [fileBase64]);
  const dtbx = useMemo(() => (fileBytes ? parseDtbxBinary(fileBytes) : null), [fileBytes]);
  const fileText = useMemo(() => {
    if (!fileBytes) return '';
    if (dtbx) return '';
    return bytesToText(fileBytes);
  }, [dtbx, fileBytes]);
  const header = useMemo(() => (fileText ? parseHeader(fileText) : null), [fileText]);
  const encMode = useMemo(() => {
    if (dtbx) return dtbx.modes.length ? dtbx.modes.join(' -> ') : 'unknown';
    const sv = header?.schemaVersion;
    if (sv === 1) return header?.encryption?.mode ?? 'unknown';
    if (sv === 2) {
      const layers = Array.isArray(header?.encryption?.layers) ? header?.encryption?.layers : [];
      const modes = layers.map((l) => l?.mode).filter((m): m is string => typeof m === 'string' && m.length > 0);
      return modes.length ? modes.join(' -> ') : 'unknown';
    }
    return 'unknown';
  }, [dtbx, header]);
  const needsPassword = useMemo(() => {
    if (dtbx) return dtbx.needsPassword;
    const sv = header?.schemaVersion;
    if (sv === 1) {
      const m = header?.encryption?.mode ?? '';
      return m === 'password' || m === 'device+password';
    }
    if (sv === 2) {
      const layers = Array.isArray(header?.encryption?.layers) ? header?.encryption?.layers : [];
      return layers.some((l) => l?.mode === 'password');
    }
    return false;
  }, [dtbx, header]);

  const canImport = useMemo(() => {
    if (!fileBase64) return false;
    if (!needsPassword) return true;
    return password.trim().length > 0;
  }, [fileBase64, needsPassword, password]);

  const chooseFile = async () => {
    setErr('');
    setOk(false);
    const res = await window.electronAPI?.openFile([{ name: 'DevToolBox Backup', extensions: ['dtbx'] }], 'base64');
    if (!res) return;
    setFilePath(res.filePath);
    setFileBase64(res.content);
  };

  const handleImport = async () => {
    setErr('');
    setOk(false);
    setBusy(true);
    try {
      const res = await window.electronAPI?.backupImport({
        content: dtbx ? fileBase64 : fileText,
        encoding: dtbx ? 'base64' : 'utf8',
        password: password.trim() || undefined,
      });
      if (!res?.success) {
        setErr(res?.error ?? 'import_failed');
        return;
      }
      if (res.localStorage) applyLocalStorage(res.localStorage);
      setOk(true);
      window.dispatchEvent(new Event('devtoolbox:backupImported'));
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap} aria-label="Import">
      <div className={styles.card}>
        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={() => void chooseFile()}>
            Choose file...
          </button>
          {filePath && <span className={styles.filePath}>{filePath}</span>}
        </div>
        {fileBase64 && (
          <div className={`${styles.row} ${styles.rowBetween}`}>
            <span className={styles.label}>Encryption</span>
            <span className={styles.filePath}>{String(encMode)}</span>
          </div>
        )}
        {needsPassword && (
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
        <div className={styles.hint}>Importing will overwrite local app data and reload the app.</div>
      </div>

      <div className={styles.card}>
        <div className={`${styles.row} ${styles.rowBetween}`}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={!canImport || busy}
            onClick={() => void handleImport()}
          >
            {busy ? 'Importing...' : 'Import...'}
          </button>
          <div className={styles.row}>
            {ok && <span className={styles.msgOk}>Imported</span>}
            {err && <span className={styles.msgErr}>{err}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
