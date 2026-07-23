import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useSplitPane } from '@@components';
import { createCodeEditorTheme } from '../../ModuleToolShared/codeMirrorTheme';
import { highlightCode } from '../../ModuleToolShared/highlightCode';
import { useJsonCodeMirrorInput } from '../../ModuleToolShared/useJsonCodeMirrorInput';
import { useTheme } from '../../../theme';
import { convertJsonXmlInput, formatJsonInput, getTextStats } from './JsonXmlConverter.model';
import type { JsonXmlMode, LocaleText, OpenTextFile } from './JsonXmlConverter.types';

export function useJsonXmlConverterController({ openFile, mt }: { openFile: OpenTextFile; mt: LocaleText }) {
  const { theme } = useTheme();
  const cmTheme = useMemo(() => createCodeEditorTheme(theme), [theme]);
  const [mode, setMode] = useState<JsonXmlMode>('jsonToXml');
  const [jsonInput, setJsonInput] = useState('');
  const [xmlInput, setXmlInput] = useState('');
  const [outputText, setOutputText] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const xmlHighlightRef = useRef<HTMLPreElement>(null);
  const { splitPercent, containerRef, handleMouseDown } = useSplitPane(50);
  const { editorHostRef } = useJsonCodeMirrorInput({
    active: mode === 'jsonToXml',
    value: jsonInput,
    cmTheme,
    onChange: setJsonInput,
  });

  const handleImport = useCallback(async () => {
    const result = await openFile(
      mode === 'jsonToXml'
        ? [
            { name: 'JSON', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] },
          ]
        : [
            { name: 'XML', extensions: ['xml'] },
            { name: 'All Files', extensions: ['*'] },
          ],
    );
    if (result === undefined) {
      fileInputRef.current?.click();
      return;
    }
    if (!result) return;
    const content = String(result.content ?? '');
    if (mode === 'jsonToXml') setJsonInput(content);
    else setXmlInput(content);
  }, [mode, openFile]);

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result ?? '');
        if (mode === 'jsonToXml') setJsonInput(content);
        else setXmlInput(content);
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    [mode],
  );

  const handleFormat = useCallback(() => {
    if (mode !== 'jsonToXml') return;
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
    const rawInput = mode === 'jsonToXml' ? jsonInput : xmlInput;
    const result = convertJsonXmlInput(mode, rawInput);
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
      `${mt(result.errorKind === 'json' ? 'errorInvalidJson' : 'errorInvalidXml')}: ${result.message}`,
    );
  }, [jsonInput, mode, mt, xmlInput]);

  const highlightedOutput = useMemo(
    () => highlightCode(outputText, mode === 'jsonToXml' ? 'xml' : 'json'),
    [mode, outputText],
  );
  const highlightedXmlInput = useMemo(() => highlightCode(xmlInput, 'xml'), [xmlInput]);

  const handleXmlScroll = useCallback(() => {
    const textarea = xmlTextareaRef.current;
    const highlight = xmlHighlightRef.current;
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
    const isXml = mode === 'jsonToXml';
    const blob = new Blob([outputText], { type: isXml ? 'application/xml' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = isXml ? 'converted.xml' : 'converted.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [mode, outputText]);

  const handleClear = useCallback(() => {
    if (mode === 'jsonToXml') setJsonInput('');
    else setXmlInput('');
    setOutputText('');
    setCopied(false);
    setError('');
  }, [mode]);

  const inputTitle = mode === 'jsonToXml' ? mt('inputJson') : mt('inputXml');
  const outputTitle = mode === 'jsonToXml' ? mt('outputXml') : mt('outputJson');
  const importLabel = mode === 'jsonToXml' ? mt('importJson') : mt('importXml');
  const acceptAttr = mode === 'jsonToXml' ? '.json,application/json' : '.xml,application/xml,text/xml';
  const inputText = mode === 'jsonToXml' ? jsonInput : xmlInput;

  return {
    containerRef,
    handleMouseDown,
    inputPaneProps: {
      widthPercent: splitPercent,
      mode,
      inputTitle,
      importLabel,
      acceptAttr,
      xmlInput,
      highlightedXmlInput,
      inputStats: getTextStats(inputText),
      editorHostRef,
      fileInputRef,
      xmlTextareaRef,
      xmlHighlightRef,
      onModeChange: setMode,
      onImport: () => void handleImport(),
      onFormat: handleFormat,
      onClear: handleClear,
      onFileSelect: handleFileSelect,
      onXmlInputChange: setXmlInput,
      onXmlScroll: handleXmlScroll,
    },
    outputPaneProps: {
      widthPercent: 100 - splitPercent,
      outputTitle,
      outputText,
      outputStats: getTextStats(outputText),
      highlightedOutput,
      placeholder: mode === 'jsonToXml' ? mt('placeholderXml') : mt('placeholderJson'),
      copied,
      error,
      onCopy: handleCopy,
      onDownload: handleDownload,
    },
  };
}
