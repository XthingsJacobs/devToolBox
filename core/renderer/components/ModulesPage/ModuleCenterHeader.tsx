import { VscExtensions, VscRefresh } from 'react-icons/vsc';
import styles from './ModulesPage.module.css';

export function ModuleCenterHeader({
  installedCount,
  availableCount,
  updateCount,
  refreshing,
  onRefresh,
}: {
  installedCount: number;
  availableCount: number;
  updateCount: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <div className={styles.headerIcon}>
          <VscExtensions size={16} />
        </div>
        <div>
          <div className={styles.headerTitle}>Module Center</div>
          <div className={styles.headerSub}>
            <span className={styles.headerSubStrong}>{installedCount} installed</span>
            <span className={styles.dotSep}>·</span>
            {availableCount} available
            {updateCount > 0 && (
              <>
                <span className={styles.dotSep}>·</span>
                <span className={styles.headerWarn}>
                  {updateCount} update{updateCount > 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <button type="button" className={styles.refreshBtn} onClick={onRefresh} aria-label="Refresh">
        <VscRefresh className={refreshing ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>
  );
}
