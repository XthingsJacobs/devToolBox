import type { ThemeSetting } from '../../theme';
import styles from './SettingsPage.module.css';
import { SettingsCard } from './SettingsCard';
import { THEME_OPTIONS } from './SettingsPage.model';
import { ThemePreview } from './ThemePreview';

export function AppearanceSection({
  themeSetting,
  onThemeChange,
}: {
  themeSetting: ThemeSetting;
  onThemeChange: (theme: ThemeSetting) => void;
}) {
  return (
    <div className={styles.stack}>
      <SettingsCard title="Theme" subtitle="Choose your interface color scheme">
        <div className={styles.themeRow}>
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={styles.themeCard}
              data-active={themeSetting === theme.id ? '1' : '0'}
              aria-pressed={themeSetting === theme.id}
              onClick={() => onThemeChange(theme.id)}
            >
              <ThemePreview theme={theme.id} />
              <div className={styles.themeLabel}>{theme.label}</div>
            </button>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
