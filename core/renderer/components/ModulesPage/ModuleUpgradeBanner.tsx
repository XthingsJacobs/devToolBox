import { VscArrowUp } from 'react-icons/vsc';
import styles from './ModulesPage.module.css';

export function ModuleUpgradeBanner({
  updateCount,
  onUpgradeAll,
}: {
  updateCount: number;
  onUpgradeAll: () => void;
}) {
  if (updateCount <= 0) return null;

  return (
    <div className={styles.upgradeBanner}>
      <div className={styles.upgradeLeft}>
        <VscArrowUp className={styles.upgradeIcon} />
        <div className={styles.upgradeText}>
          <span className={styles.upgradeTitle}>
            {updateCount} update{updateCount > 1 ? 's' : ''} available
          </span>
          <span className={styles.upgradeSub}>Keep your modules up to date for the latest fixes.</span>
        </div>
      </div>
      <button type="button" className={styles.upgradeBtn} onClick={onUpgradeAll}>
        Update All
      </button>
    </div>
  );
}
