import ResponsiveActions from '../../ResponsiveActions';
import { CODE_LANGUAGES, type CodeLanguage, type LocaleText } from './RegexTester.types';
import styles from './RegexTester.module.css';

export function RegexCodegenPanel({
  pattern,
  codeLang,
  codeOutput,
  copied,
  onPatternChange,
  onCodeLangChange,
  onCopyCode,
  mt,
}: {
  pattern: string;
  codeLang: CodeLanguage;
  codeOutput: string;
  copied: boolean;
  onPatternChange: (value: string) => void;
  onCodeLangChange: (value: CodeLanguage) => void;
  onCopyCode: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.body}>
      <div className={styles.regexRow}>
        <input
          className={styles.regexInput}
          value={pattern}
          onChange={(event) => onPatternChange(event.target.value)}
          placeholder={mt('regexPlaceholder')}
          spellCheck={false}
        />
        <select
          className={styles.langSelect}
          value={codeLang}
          onChange={(event) => onCodeLangChange(event.target.value as CodeLanguage)}
        >
          {CODE_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </select>
      </div>
      {codeOutput && (
        <div className={styles.codeSection}>
          <div className={styles.codeHeader}>
            <span>{codeLang} Code</span>
            <ResponsiveActions
              actions={[{ label: copied ? mt('copied') : mt('copyCode'), onClick: onCopyCode }]}
            />
          </div>
          <pre className={styles.codeBlock}>{codeOutput}</pre>
        </div>
      )}
    </div>
  );
}
