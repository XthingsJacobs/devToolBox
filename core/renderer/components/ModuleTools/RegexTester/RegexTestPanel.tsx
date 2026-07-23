import type { ChangeEvent } from 'react';
import SafeHtml from '../../SafeHtml';
import type { LocaleText, RegexMatch } from './RegexTester.types';
import styles from './RegexTester.module.css';

export function RegexTestPanel({
  pattern,
  replacement,
  testText,
  flagI,
  flagM,
  flagG,
  highlightRegex,
  highlightMatch,
  highlightNoMatch,
  matches,
  highlightedHtml,
  replacedText,
  onPatternChange,
  onReplacementChange,
  onTestTextChange,
  onFlagIChange,
  onFlagMChange,
  onFlagGChange,
  onHighlightRegexChange,
  onHighlightMatchChange,
  onHighlightNoMatchChange,
  onReplace,
  mt,
}: {
  pattern: string;
  replacement: string;
  testText: string;
  flagI: boolean;
  flagM: boolean;
  flagG: boolean;
  highlightRegex: boolean;
  highlightMatch: boolean;
  highlightNoMatch: boolean;
  matches: RegexMatch[];
  highlightedHtml: string;
  replacedText: string;
  onPatternChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
  onTestTextChange: (value: string) => void;
  onFlagIChange: (value: boolean) => void;
  onFlagMChange: (value: boolean) => void;
  onFlagGChange: (value: boolean) => void;
  onHighlightRegexChange: (value: boolean) => void;
  onHighlightMatchChange: (value: boolean) => void;
  onHighlightNoMatchChange: (value: boolean) => void;
  onReplace: () => void;
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
        <input
          className={styles.replaceInput}
          value={replacement}
          onChange={(event) => onReplacementChange(event.target.value)}
          placeholder={mt('replacePlaceholder')}
          spellCheck={false}
        />
        <button className={styles.replaceBtn} onClick={onReplace} disabled={!replacedText}>
          {mt('replaceBtn')}
        </button>
      </div>

      <RegexOptions
        flagI={flagI}
        flagM={flagM}
        flagG={flagG}
        highlightRegex={highlightRegex}
        highlightMatch={highlightMatch}
        highlightNoMatch={highlightNoMatch}
        onFlagIChange={onFlagIChange}
        onFlagMChange={onFlagMChange}
        onFlagGChange={onFlagGChange}
        onHighlightRegexChange={onHighlightRegexChange}
        onHighlightMatchChange={onHighlightMatchChange}
        onHighlightNoMatchChange={onHighlightNoMatchChange}
        mt={mt}
      />

      <div className={styles.testArea}>
        <textarea
          className={styles.testInput}
          value={testText}
          onChange={(event) => onTestTextChange(event.target.value)}
          placeholder={mt('testPlaceholder')}
          spellCheck={false}
        />
      </div>
      {testText && highlightMatch && (
        <div className={styles.resultArea}>
          <div className={styles.resultLabel}>
            {mt('matchResult')} ({matches.length} {mt('matchCount')})
          </div>
          <SafeHtml className={styles.highlighted} html={highlightedHtml} profile="syntax" />
        </div>
      )}
      {matches.length > 0 && <RegexMatchList matches={matches} mt={mt} />}
    </div>
  );
}

function RegexOptions({
  flagI,
  flagM,
  flagG,
  highlightRegex,
  highlightMatch,
  highlightNoMatch,
  onFlagIChange,
  onFlagMChange,
  onFlagGChange,
  onHighlightRegexChange,
  onHighlightMatchChange,
  onHighlightNoMatchChange,
  mt,
}: {
  flagI: boolean;
  flagM: boolean;
  flagG: boolean;
  highlightRegex: boolean;
  highlightMatch: boolean;
  highlightNoMatch: boolean;
  onFlagIChange: (value: boolean) => void;
  onFlagMChange: (value: boolean) => void;
  onFlagGChange: (value: boolean) => void;
  onHighlightRegexChange: (value: boolean) => void;
  onHighlightMatchChange: (value: boolean) => void;
  onHighlightNoMatchChange: (value: boolean) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.optionsRow}>
      <Checkbox checked={flagI} onChange={onFlagIChange} label={mt('flagCaseInsensitive')} />
      <Checkbox checked={flagM} onChange={onFlagMChange} label={mt('flagMultiline')} />
      <Checkbox checked={flagG} onChange={onFlagGChange} label={mt('flagGlobal')} />
      <Checkbox
        checked={highlightRegex}
        onChange={onHighlightRegexChange}
        label={mt('flagHighlightRegex')}
        active={highlightRegex}
      />
      <Checkbox
        checked={highlightMatch}
        onChange={onHighlightMatchChange}
        label={mt('flagHighlightMatch')}
        active={highlightMatch}
      />
      <Checkbox
        checked={highlightNoMatch}
        onChange={onHighlightNoMatchChange}
        label={mt('flagHighlightNoMatch')}
      />
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  active = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  active?: boolean;
}) {
  return (
    <label className={`${styles.checkLabel} ${active ? styles.checkActive : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function RegexMatchList({ matches, mt }: { matches: RegexMatch[]; mt: LocaleText }) {
  return (
    <div className={styles.matchList}>
      <div className={styles.resultLabel}>{mt('matchDetail')}</div>
      <div className={styles.matchItems}>
        {matches.map((match, index) => (
          <span key={index} className={styles.matchItem}>
            <span className={styles.matchIndex}>#{index + 1}</span>
            <span className={styles.matchText}>{match.text}</span>
            <span className={styles.matchPos}>
              [{match.start}-{match.end}]
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
