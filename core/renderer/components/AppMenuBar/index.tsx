import styles from './AppMenuBar.module.css';

export default function AppMenuBar() {
  return (
    <div className={styles.menu}>
      <span className={styles.item}>DevToolBox</span>
      <span className={styles.item}>Edit</span>
      <span className={styles.item}>View</span>
      <span className={styles.item}>Help</span>
    </div>
  );
}

