import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSplitPane } from '@@components';
import { createCodeEditorTheme } from '../../ModuleToolShared/codeMirrorTheme';
import { highlightCode } from '../../ModuleToolShared/highlightCode';
import { useJsonCodeMirrorInput } from '../../ModuleToolShared/useJsonCodeMirrorInput';
import { useTheme } from '../../../theme';
import { convertJsonYamlInput, formatJsonInput, getTextStats } from './JsonYamlConverter.model';
import type { JsonYamlMode, LocaleText, OpenTextFile } from './JsonYamlConverter.types';

export function useJsonYamlConverterController({ openFile, mt }: { openFile: OpenTextFile; mt: LocaleText }) {
  const { theme } = useTheme();
  const cmTheme = useMemo(() => createCodeEditorTheme(theme), [theme]);
  const [mode, setMode] = useState<JsonYamlMode>('jsonToYaml');
  const [jsonInput, setJsonInput] = useState('');
  const [yamlInput, setYamlInput] = useState('');
  const [outputText, setOutputText] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const yamlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const yamlHighlightRef = useRef<HTMLPreElement>(null);
  const { splitPercent, containerRef, handleMouseDown } = useSplitPane(50);
  const { editorHostRef } = useJsonCodeMirrorInput({
    active: mode === 'jsonToYaml',
    value: jsonInput,
    cmTheme,
    onChange: setJsonInput,
  });

  const handleImport = useCallback(async () => {
    const result = await openFile(
      mode === 'jsonToYaml'
        ? [
            { name: 'JSON', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ]
        : [
            { name: 'YAML', extensions: ['yml', 'yaml'] },
            { name: 'All Files', extensions: ['*'] },
          ],
    );
    if (result === undefined) {
      fileInputRef.current?.click();
      return;
    }
    if (!result) return;
    const content = String(result.content ?? '');
    if (mode === 'jsonToYaml') setJsonInput(content);
    else setYamlInput(content);
  }, [mode, openFile]);

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result ?? '');
        if (mode === 'jsonToYaml') setJsonInput(content);
        else setYamlInput(content);
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    [mode],
  );

  const handleFormat = useCallback(() => {
    if (mode !== 'jsonToYaml') return;
    const raw = jsonInput.trim();
    if (!raw) return;
    const result = formatJsonInput(raw);
    if (result.ok) {
      setJsonInput(result.output);
      setError('');
    } else {
      setError(`${mt('errorInvalidJson')}: ${result.message}`);
    }
  }, [jsonInput, mode, mt]);

  useEffect(() => {
    const rawInput = mode === 'jsonToYaml' ? jsonInput : yamlInput;
    const result = convertJsonYamlInput(mode, rawInput);
    if (!result) {
      setOutputText('');
      setError('');
      return;
    }
    if (result.ok) {
      setOutputText(result.output);
      setError('');
      return;
    }
    setOutputText('');
    setError(
      `${mt(result.errorKind === 'json' ? 'errorInvalidJson' : 'errorInvalidYaml')}: ${result.message}`,
    );
  }, [jsonInput, mode, mt, yamlInput]);

  const highlightedOutput = useMemo(
    () => highlightCode(outputText, mode === 'jsonToYaml' ? 'yaml' : 'json'),
    [mode, outputText],
  );
  const highlightedYamlInput = useMemo(() => highlightCode(yamlInput, 'yaml'), [yamlInput]);

  const handleYamlScroll = useCallback(() => {
    const textarea = yamlTextareaRef.current;
    const highlight = yamlHighlightRef.current;
    if (!textarea || !highlight) return;
    highlight.scrollTop = textarea.scrollTop;
    highlight.scrollLeft = textarea.scrollLeft;
  }, []);

  const handleCopy = useCallback(async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [outputText]);

  const handleDownload = useCallback(() => {
    if (!outputText) return;
    const isYaml = mode === 'jsonToYaml';
    const blob = new Blob([outputText], { type: isYaml ? 'text/yaml' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = isYaml ? 'converted.yaml' : 'converted.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [mode, outputText]);

  const handleClear = useCallback(() => {
    if (mode === 'jsonToYaml') setJsonInput('');
    else setYamlInput('');
    setOutputText('');
    setCopied(false);
    setError('');
  }, [mode]);

  const inputTitle = mode === 'jsonToYaml' ? mt('inputJson') : mt('inputYaml');
  const outputTitle = mode === 'jsonToYaml' ? mt('outputYaml') : mt('outputJson');
  const importLabel = mode === 'jsonToYaml' ? mt('importJson') : mt('importYaml');
  const acceptAttr =
    mode === 'jsonToYaml' ? '.json,application/json' : '.yml,.yaml,text/yaml,application/x-yaml';
  const inputText = mode === 'jsonToYaml' ? jsonInput : yamlInput;

  return {
    containerRef,
    handleMouseDown,
    inputPaneProps: {
      widthPercent: splitPercent,
      mode,
      inputTitle,
      importLabel,
      acceptAttr,
      yamlInput,
      highlightedYamlInput,
      inputStats: getTextStats(inputText),
      editorHostRef,
      fileInputRef,
      yamlTextareaRef,
      yamlHighlightRef,
      onModeChange: setMode,
      onImport: () => void handleImport(),
      onFormat: handleFormat,
      onClear: handleClear,
      onFileSelect: handleFileSelect,
      onYamlInputChange: setYamlInput,
      onYamlScroll: handleYamlScroll,
    },
    outputPaneProps: {
      widthPercent: 100 - splitPercent,
      outputTitle,
      outputText,
      outputStats: getTextStats(outputText),
      highlightedOutput,
      placeholder: mode === 'jsonToYaml' ? mt('placeholderYaml') : mt('placeholderJson'),
      copied,
      error,
      onCopy: handleCopy,
      onDownload: handleDownload,
    },
  };
}
