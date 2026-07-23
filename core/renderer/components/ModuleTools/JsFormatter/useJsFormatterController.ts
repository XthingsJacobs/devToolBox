import { useCallback, useMemo, useRef, useState } from 'react';
import { DEFAULT_JS, getJsTextStats } from './JsFormatter.model';
import { useJsCodeMirrorTheme } from './useJsCodeMirrorTheme';
import { useJsFormatterActions } from './useJsFormatterActions';
import { useJsHighlightedOutput } from './useJsHighlightedOutput';
import { useJsInputEditor } from './useJsInputEditor';
import { useJsSplitPane } from './useJsSplitPane';

export function useJsFormatterController() {
  const [input, setInput] = useState(DEFAULT_JS);
  const cmTheme = useJsCodeMirrorTheme();
  const { containerRef, splitPercent, handleMouseDown } = useJsSplitPane(50);
  const outputRef = useRef<HTMLDivElement>(null);

  const clearInput = useCallback(() => setInput(''), []);
  const actions = useJsFormatterActions(input, clearInput);
  const inputEditor = useJsInputEditor({ input, cmTheme, onInputChange: setInput });
  const highlightedOutput = useJsHighlightedOutput({
    output: actions.output,
    highlight: actions.highlight,
    cmTheme,
  });

  const inputStats = useMemo(() => getJsTextStats(input, 1), [input]);
  const outputStats = useMemo(() => getJsTextStats(actions.output, 0), [actions.output]);

  const handleOutputScrollTop = useCallback(() => {
    if (actions.highlight) {
      highlightedOutput.scrollToTop();
      return;
    }
    outputRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [actions.highlight, highlightedOutput]);

  return {
    containerRef,
    handleMouseDown,
    inputPaneProps: {
      widthPercent: splitPercent,
      editorRef: inputEditor.editorRef,
      inputStats,
      showInputScrollTop: inputEditor.showScrollTop,
      onBeautify: actions.handleBeautify,
      onMinify: actions.handleMinify,
      onObfuscate: actions.handleObfuscate,
      onEvalPack: actions.handleEvalPack,
      onHighCompress: actions.handleHighCompress,
      onClear: actions.handleClear,
      onInputScrollTop: inputEditor.scrollToTop,
    },
    outputPaneProps: {
      widthPercent: 100 - splitPercent,
      output: actions.output,
      error: actions.error,
      processing: actions.processing,
      highlight: actions.highlight,
      copied: actions.copied,
      outputStats,
      outputRef,
      outputEditorRef: highlightedOutput.outputEditorRef,
      showOutputScrollTop: actions.highlight ? highlightedOutput.showScrollTop : false,
      onCopy: actions.handleCopy,
      onOutputScrollTop: handleOutputScrollTop,
    },
  };
}
