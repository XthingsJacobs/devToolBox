import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  formatJsonText,
  getDisplayData,
  getNextSortOrder,
  getTextStats,
  parseJsonInput,
} from './JsonFormatter.model';
import type { OutputViewMode, SortOrder } from './JsonFormatter.types';
import { useJsonTextSearch } from './useJsonTextSearch';
import { useResizableSplit } from './useResizableSplit';
import { useScrollTop } from './useScrollTop';

export function useJsonFormatterController() {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<unknown>(undefined);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');
  const [compressed, setCompressed] = useState(false);
  const [expandAll, setExpandAll] = useState(true);
  const [treeKey, setTreeKey] = useState(0);
  const [outputViewMode, setOutputViewMode] = useState<OutputViewMode>('tree');

  const { containerRef, splitPercent, handleMouseDown } = useResizableSplit(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputFocusRef = useRef<HTMLDivElement>(null);
  const outputTreeRef = useRef<HTMLDivElement>(null);
  const outputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const prevOutputViewMode = useRef<OutputViewMode>('tree');

  const inputScroll = useScrollTop(textareaRef);
  const outputScroll = useScrollTop(outputTreeRef);
  const outputTextScroll = useScrollTop(outputTextareaRef);

  const inputStats = useMemo(() => getTextStats(input), [input]);
  const displayData = useMemo(
    () => (parsed === undefined ? undefined : getDisplayData(parsed, sortOrder)),
    [parsed, sortOrder],
  );
  const formattedText = useMemo(
    () => (displayData === undefined ? '' : formatJsonText(displayData, compressed)),
    [compressed, displayData],
  );
  const outputStats = useMemo(() => getTextStats(formattedText), [formattedText]);
  const isTextOutput = compressed || outputViewMode === 'text';
  const activeOutputScroll = isTextOutput ? outputTextScroll : outputScroll;

  const focusInputTextarea = useCallback(() => textareaRef.current?.focus(), []);
  const openOutputSearch = useCallback(() => {
    prevOutputViewMode.current = outputViewMode;
    setOutputViewMode('text');
  }, [outputViewMode]);
  const closeOutputSearch = useCallback(() => {
    setOutputViewMode(prevOutputViewMode.current);
    outputFocusRef.current?.focus?.();
  }, []);

  const inputSearch = useJsonTextSearch({
    text: input,
    textareaRef,
    onClose: focusInputTextarea,
  });
  const outputSearch = useJsonTextSearch({
    text: formattedText,
    textareaRef: outputTextareaRef,
    onOpen: openOutputSearch,
    onClose: closeOutputSearch,
  });

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setCompressed(false);
    setSortOrder('none');

    const result = parseJsonInput(value);
    if (!result) {
      setParsed(undefined);
      setError('');
      return;
    }
    if (result.ok) {
      setParsed(result.parsed);
      setError('');
      return;
    }
    setParsed(undefined);
    setError(result.error);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!formattedText) return;
    await navigator.clipboard.writeText(formattedText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [formattedText]);

  const handleDownload = useCallback(() => {
    if (!formattedText) return;
    const blob = new Blob([formattedText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'formatted.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [formattedText]);

  const handleToggleExpand = useCallback(() => {
    setExpandAll((prev) => !prev);
    setTreeKey((key) => key + 1);
  }, []);

  const handleSort = useCallback(() => {
    if (parsed === undefined) return;
    setSortOrder(getNextSortOrder);
  }, [parsed]);

  const handleCompress = useCallback(() => setCompressed(true), []);
  const handleFormat = useCallback(() => setCompressed(false), []);

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => handleInputChange(String(reader.result ?? ''));
      reader.readAsText(file);
      event.target.value = '';
    },
    [handleInputChange],
  );

  return {
    containerRef,
    handleMouseDown,
    inputPaneProps: {
      widthPercent: splitPercent,
      input,
      inputStats,
      textareaRef,
      fileInputRef,
      searchInputRef: inputSearch.searchInputRef,
      overlayRef: inputSearch.overlayRef,
      searchVisible: inputSearch.visible,
      searchTerm: inputSearch.term,
      matches: inputSearch.matches,
      currentMatchIndex: inputSearch.currentMatchIndex,
      highlightContent: inputSearch.highlightContent,
      inputScroll,
      onInputChange: handleInputChange,
      onFileSelect: handleFileSelect,
      onSearchTermChange: inputSearch.setTerm,
      onTextareaKeyDown: inputSearch.handleTextareaKeyDown,
      onSearchKeyDown: inputSearch.handleSearchKeyDown,
      onPrevMatch: inputSearch.goToPrevMatch,
      onNextMatch: inputSearch.goToNextMatch,
      onCloseSearch: inputSearch.closeSearch,
    },
    outputPaneProps: {
      widthPercent: 100 - splitPercent,
      displayData,
      error,
      formattedText,
      outputStats,
      isTextOutput,
      outputFocusRef,
      outputTreeRef,
      outputTextareaRef,
      outputSearchInputRef: outputSearch.searchInputRef,
      outputOverlayRef: outputSearch.overlayRef,
      outputSearchVisible: outputSearch.visible,
      outputSearchTerm: outputSearch.term,
      outputMatches: outputSearch.matches,
      outputCurrentMatchIndex: outputSearch.currentMatchIndex,
      outputHighlightContent: outputSearch.highlightContent,
      activeOutputScroll,
      copied,
      sortOrder,
      expandAll,
      treeKey,
      onCompress: handleCompress,
      onFormat: handleFormat,
      onCopy: handleCopy,
      onDownload: handleDownload,
      onSort: handleSort,
      onToggleExpand: handleToggleExpand,
      onOutputSearchTermChange: outputSearch.setTerm,
      onOutputContainerKeyDown: outputSearch.handleContainerKeyDown,
      onOutputTextareaKeyDown: outputSearch.handleTextareaKeyDown,
      onOutputSearchKeyDown: outputSearch.handleSearchKeyDown,
      onPrevOutputMatch: outputSearch.goToPrevMatch,
      onNextOutputMatch: outputSearch.goToNextMatch,
      onCloseOutputSearch: outputSearch.closeSearch,
    },
  };
}
