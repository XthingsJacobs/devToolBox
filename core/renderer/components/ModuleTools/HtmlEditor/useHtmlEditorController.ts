import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { html } from '@codemirror/lang-html';
import { createCodeEditorTheme } from '../../ModuleToolShared/codeMirrorTheme';
import { useCodeMirrorTextEditor } from '../../ModuleToolShared/useCodeMirrorTextEditor';
import { useTheme } from '../../../theme';
import {
  beautifyHtml,
  compressHtml,
  createHtmlPreview,
  DEFAULT_HTML,
  getHtmlTextStats,
} from './HtmlEditor.model';
import type { HtmlFileBridge, LocaleText } from './HtmlEditor.types';

const PREVIEW_DEFAULT_PX = 520;
const PANE_MIN_PX = 360;
const DIVIDER_PX = 8;

export function useHtmlEditorController({ fileBridge, mt }: { fileBridge: HtmlFileBridge; mt: LocaleText }) {
  const { theme } = useTheme();
  const [input, setInput] = useState(DEFAULT_HTML);
  const [copied, setCopied] = useState(false);
  const [splitPercent, setSplitPercent] = useState(50);
  const [sourceFilePath, setSourceFilePath] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const cmTheme = useMemo(() => createCodeEditorTheme(theme), [theme]);
  const htmlLanguage = useMemo(() => html(), []);
  const editor = useCodeMirrorTextEditor({
    value: input,
    cmTheme,
    languageExtension: htmlLanguage,
    onChange: setInput,
    searchEnabled: true,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const didInitSplitRef = useRef(false);

  const handleMouseDown = useCallback(() => {
    dragging.current = true;
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (event: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawPercent = ((event.clientX - rect.left) / rect.width) * 100;
      const minPercent = (PANE_MIN_PX / rect.width) * 100;
      const maxPercent = 100 - minPercent;
      setSplitPercent(Math.min(maxPercent, Math.max(minPercent, rawPercent)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  useEffect(() => {
    if (didInitSplitRef.current) return;
    const element = containerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) return;
    const preview = Math.min(PREVIEW_DEFAULT_PX, Math.max(PANE_MIN_PX, rect.width * 0.45));
    const editorPx = Math.max(PANE_MIN_PX, rect.width - preview - DIVIDER_PX);
    const percent = (editorPx / rect.width) * 100;
    const minPercent = (PANE_MIN_PX / rect.width) * 100;
    const maxPercent = 100 - minPercent;
    setSplitPercent(Math.min(maxPercent, Math.max(minPercent, percent)));
    didInitSplitRef.current = true;
  }, []);

  const htmlFilters = useMemo(
    () => [
      { name: mt('htmlFiles'), extensions: ['html', 'htm'] },
      { name: mt('allFiles'), extensions: ['*'] },
    ],
    [mt],
  );

  const handleCopy = useCallback(async () => {
    if (!input) return;
    await navigator.clipboard.writeText(input);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }, [input]);

  const handleDownload = useCallback(() => {
    if (!input) return;
    const blob = new Blob([input], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'page.html';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [input]);

  const handleOpen = useCallback(async () => {
    if (!fileBridge.isAvailable()) {
      fileInputRef.current?.click();
      return;
    }
    const result = await fileBridge.openFile(htmlFilters);
    if (result) {
      setSourceFilePath(result.filePath);
      setInput(result.content);
    }
  }, [fileBridge, htmlFilters]);

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSourceFilePath(null);
    const reader = new FileReader();
    reader.onload = () => setInput(reader.result as string);
    reader.readAsText(file);
    event.target.value = '';
  }, []);

  const handleCompress = useCallback(() => {
    if (!input) return;
    setInput(compressHtml(input));
  }, [input]);

  const handleBeautify = useCallback(() => {
    if (!input) return;
    setInput(beautifyHtml(input));
  }, [input]);

  const handleSave = useCallback(async () => {
    if (!input) return;
    if (!fileBridge.isAvailable()) {
      handleDownload();
      return;
    }
    if (sourceFilePath) {
      const confirmed = await fileBridge.confirmOverwrite(sourceFilePath);
      if (confirmed) await fileBridge.saveFile(sourceFilePath, input);
    } else {
      const saved = await fileBridge.saveFileAs('page.html', input, htmlFilters);
      if (saved) setSourceFilePath(saved);
    }
  }, [fileBridge, handleDownload, htmlFilters, input, sourceFilePath]);

  const handleSaveAs = useCallback(async () => {
    if (!input) return;
    if (!fileBridge.isAvailable()) {
      handleDownload();
      return;
    }
    const saved = await fileBridge.saveFileAs('page.html', input, htmlFilters);
    if (saved) setSourceFilePath(saved);
  }, [fileBridge, handleDownload, htmlFilters, input]);

  return {
    containerRef,
    handleMouseDown,
    editorPaneProps: {
      widthPercent: splitPercent,
      minPaneWidth: PANE_MIN_PX,
      copied,
      fileInputRef,
      editorRef: editor.editorRef,
      showScrollTop: editor.showScrollTop,
      inputStats: getHtmlTextStats(input),
      onOpen: () => void handleOpen(),
      onSave: () => void handleSave(),
      onSaveAs: () => void handleSaveAs(),
      onCompress: handleCompress,
      onBeautify: handleBeautify,
      onCopy: () => void handleCopy(),
      onDownload: handleDownload,
      onClear: () => setInput(''),
      onFileSelect: handleFileSelect,
      onScrollTop: editor.scrollToTop,
    },
    previewPaneProps: {
      widthPercent: 100 - splitPercent,
      minPaneWidth: PANE_MIN_PX,
      previewHtml: createHtmlPreview(input),
      isDragging,
    },
  };
}
