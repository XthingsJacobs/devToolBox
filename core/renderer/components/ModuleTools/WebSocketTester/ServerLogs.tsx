import styles from './ServerPanel.module.css';
import type { LogItem } from './ServerPanel.types';

function logClass(kind: LogItem['kind']): string {
  if (kind === 'recv') return styles.logRecv;
  if (kind === 'send') return styles.logSend;
  if (kind === 'error') return styles.logError;
  return styles.logSystem;
}

export function ServerLogs({ logs }: { logs: LogItem[] }) {
  return (
    <div className={styles.outputArea}>
      {logs.length === 0 ? (
        <div className={styles.outputEmpty}>No logs.</div>
      ) : (
        <div className={styles.logList}>
          {logs.map((log, index) => (
            <div key={`${log.ts}_${index}`} className={`${styles.logLine} ${logClass(log.kind)}`}>
              <span className={styles.logTs}>{log.ts}</span>
              <span className={styles.logLv}>{log.level.toUpperCase()}</span>
              <span className={styles.logMsg}>{log.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
