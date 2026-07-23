import type { LocaleText, PresetRegex, RegexTab } from './RegexTester.types';
import styles from './RegexTester.module.css';

export function RegexHeader({
  tab,
  onTabChange,
  onShowHelp,
  mt,
}: {
  tab: RegexTab;
  onTabChange: (tab: RegexTab) => void;
  onShowHelp: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.header}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'test' ? styles.tabActive : ''}`}
          onClick={() => onTabChange('test')}
        >
          {mt('tabTest')}
        </button>
        <button
          className={`${styles.tab} ${tab === 'codegen' ? styles.tabActive : ''}`}
          onClick={() => onTabChange('codegen')}
        >
          {mt('tabCodegen')}
        </button>
      </div>
      <button className={styles.helpBtn} onClick={onShowHelp}>
        {mt('help')}
      </button>
    </div>
  );
}

export function RegexPresets({
  presets,
  onSelect,
  mt,
}: {
  presets: PresetRegex[];
  onSelect: (preset: PresetRegex) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.presetsSection}>
      <div className={styles.presetsLabel}>{mt('presetsLabel')}</div>
      <div className={styles.presetsList}>
        {presets.map((preset) => (
          <button key={preset.label} className={styles.presetBtn} onClick={() => onSelect(preset)}>
            {mt(preset.label)}
          </button>
        ))}
      </div>
    </div>
  );
}
