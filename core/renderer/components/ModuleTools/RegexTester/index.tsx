import { useCallback } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import RegexHelp from './RegexHelp';
import { RegexCodegenPanel, RegexHeader, RegexPresets, RegexTestPanel } from './RegexTesterPanes';
import { useRegexTesterController } from './useRegexTesterController';
import styles from './RegexTester.module.css';

export default function RegexTester() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'RegexTester');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const controller = useRegexTesterController();

  return (
    <div className={styles.container}>
      <RegexHeader
        tab={controller.tab}
        onTabChange={controller.setTab}
        onShowHelp={() => controller.setShowHelp(true)}
        mt={mt}
      />
      <RegexPresets presets={controller.presets} onSelect={controller.selectPreset} mt={mt} />
      {controller.tab === 'test' ? (
        <RegexTestPanel
          {...controller}
          onPatternChange={controller.setPattern}
          onReplacementChange={controller.setReplacement}
          onTestTextChange={controller.setTestText}
          onFlagIChange={controller.setFlagI}
          onFlagMChange={controller.setFlagM}
          onFlagGChange={controller.setFlagG}
          onHighlightRegexChange={controller.setHighlightRegex}
          onHighlightMatchChange={controller.setHighlightMatch}
          onHighlightNoMatchChange={controller.setHighlightNoMatch}
          onReplace={controller.handleReplace}
          mt={mt}
        />
      ) : (
        <RegexCodegenPanel
          {...controller}
          onPatternChange={controller.setPattern}
          onCodeLangChange={controller.setCodeLang}
          onCopyCode={controller.handleCopyCode}
          mt={mt}
        />
      )}
      {controller.showHelp && <RegexHelp onClose={() => controller.setShowHelp(false)} />}
    </div>
  );
}
