import type { ThemeSetting } from '../../theme';
import styles from './SettingsPage.module.css';

export function ThemePreview({ theme }: { theme: ThemeSetting }) {
  return (
    <span className={styles.themePreview} data-theme={theme} aria-hidden="true">
      <span className={styles.themePreviewPane} data-preview-theme={theme}>
        <span className={styles.themePreviewSidebar}>
          <span className={styles.themePreviewLogo} />
          <span className={styles.themePreviewNavActive} />
          <span className={styles.themePreviewNav} />
        </span>
        <span className={styles.themePreviewMain}>
          <span className={styles.themePreviewHeading} />
          <span className={styles.themePreviewLine} />
          <span className={styles.themePreviewPanels}>
            <span />
            <span />
          </span>
        </span>
      </span>
    </span>
  );
}
