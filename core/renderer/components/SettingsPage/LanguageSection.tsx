import styles from './SettingsPage.module.css';
import { SettingsCard } from './SettingsCard';
import { LANGUAGE_OPTIONS, type SettingsLocaleSetting } from './SettingsPage.model';

export function LanguageSection({
  localeSetting,
  onLocaleChange,
}: {
  localeSetting: SettingsLocaleSetting;
  onLocaleChange: (locale: SettingsLocaleSetting) => void;
}) {
  return (
    <div className={styles.stack}>
      <SettingsCard title="Interface Language" subtitle="Set the display language for DevToolBox UI">
        <div className={styles.langList}>
          {LANGUAGE_OPTIONS.map((language) => (
            <button
              key={language.id}
              type="button"
              className={styles.langItem}
              aria-pressed={localeSetting === language.id}
              data-active={localeSetting === language.id ? '1' : '0'}
              onClick={() => onLocaleChange(language.id)}
            >
              <span className={styles.radio} data-active={localeSetting === language.id ? '1' : '0'}>
                <span className={styles.radioDot} data-active={localeSetting === language.id ? '1' : '0'} />
              </span>
              <span className={styles.langText}>
                <span className={styles.langLabel}>{language.label}</span>
                <span className={styles.langSub}>{language.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <div className={styles.notice}>
          A restart may be required for language changes to fully take effect.
        </div>
      </SettingsCard>
    </div>
  );
}
