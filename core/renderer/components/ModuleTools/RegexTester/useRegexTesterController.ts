import { useCallback, useMemo, useState } from 'react';
import {
  buildHighlightedHtml,
  buildRegexFlags,
  compileRegex,
  findRegexMatches,
  generateCode,
  PRESETS,
  replaceRegexMatches,
} from './RegexTester.model';
import type { CodeLanguage, PresetRegex, RegexTab } from './RegexTester.types';
import styles from './RegexTester.module.css';

export function useRegexTesterController() {
  const [tab, setTab] = useState<RegexTab>('test');
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');
  const [testText, setTestText] = useState('');
  const [flagI, setFlagI] = useState(false);
  const [flagM, setFlagM] = useState(false);
  const [flagG, setFlagG] = useState(true);
  const [highlightRegex, setHighlightRegex] = useState(true);
  const [highlightMatch, setHighlightMatch] = useState(true);
  const [highlightNoMatch, setHighlightNoMatch] = useState(false);
  const [codeLang, setCodeLang] = useState<CodeLanguage>('JavaScript');
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const flags = useMemo(
    () => buildRegexFlags({ global: flagG, ignoreCase: flagI, multiline: flagM }),
    [flagG, flagI, flagM],
  );
  const regex = useMemo(() => compileRegex(pattern, flags), [flags, pattern]);
  const matches = useMemo(() => findRegexMatches(pattern, flags, testText), [flags, pattern, testText]);
  const highlightedHtml = useMemo(
    () =>
      buildHighlightedHtml({
        text: testText,
        matches,
        highlightNoMatch,
        classes: { match: styles.match, noMatch: styles.noMatch },
      }),
    [highlightNoMatch, matches, testText],
  );
  const replacedText = useMemo(
    () => replaceRegexMatches(pattern, flags, testText, replacement),
    [flags, pattern, replacement, testText],
  );
  const codeOutput = useMemo(
    () => (pattern ? generateCode(pattern, flags, codeLang) : ''),
    [codeLang, flags, pattern],
  );

  const selectPreset = useCallback((preset: PresetRegex) => {
    setPattern(preset.pattern);
    if (preset.flags?.includes('g')) setFlagG(true);
  }, []);

  const handleCopyCode = useCallback(async () => {
    if (!codeOutput) return;
    try {
      await navigator.clipboard.writeText(codeOutput);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access is optional in restricted renderer contexts.
    }
  }, [codeOutput]);

  const handleReplace = useCallback(() => {
    if (replacedText) setTestText(replacedText);
  }, [replacedText]);

  return {
    tab,
    setTab,
    pattern,
    setPattern,
    replacement,
    setReplacement,
    testText,
    setTestText,
    flagI,
    setFlagI,
    flagM,
    setFlagM,
    flagG,
    setFlagG,
    highlightRegex,
    setHighlightRegex,
    highlightMatch,
    setHighlightMatch,
    highlightNoMatch,
    setHighlightNoMatch,
    codeLang,
    setCodeLang,
    copied,
    showHelp,
    setShowHelp,
    regex,
    matches,
    highlightedHtml,
    replacedText,
    codeOutput,
    presets: PRESETS,
    selectPreset,
    handleCopyCode,
    handleReplace,
  };
}
