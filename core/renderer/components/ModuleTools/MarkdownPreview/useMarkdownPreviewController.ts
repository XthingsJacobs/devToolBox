import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { markdown } from '@codemirror/lang-markdown';
import { LanguageDescription } from '@codemirror/language';
import { createCodeEditorTheme } from '../../ModuleToolShared/codeMirrorTheme';
import { useCodeMirrorTextEditor } from '../../ModuleToolShared/useCodeMirrorTextEditor';
import { useTheme } from '../../../theme';
import {
  createMarkdownPreviewHtml,
  defaultPreviewPalette,
  DEFAULT_MD,
  getMarkdownTextStats,
  resolvePreviewPalette,
} from './MarkdownPreview.model';
import type { MarkdownFileBridge, LocaleText } from './MarkdownPreview.types';

const markdownCodeLanguages = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'jsx', 'mjs', 'cjs'],
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    load: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true }),
  }),
  LanguageDescription.of({
    name: 'TypeScript',
    alias: ['ts', 'tsx'],
    extensions: ['ts', 'tsx'],
    load: async () =>
      (await import('@codemirror/lang-javascript')).javascript({ jsx: true, typescript: true }),
  }),
  LanguageDescription.of({
    name: 'HTML',
    alias: ['html', 'xml'],
    extensions: ['html', 'htm', 'xml'],
    load: async () => (await import('@codemirror/lang-html')).html(),
  }),
  LanguageDescription.of({
    name: 'JSON',
    alias: ['json', 'jsonc'],
    extensions: ['json', 'jsonc'],
    load: async () => (await import('@codemirror/lang-json')).json(),
  }),
];

export function useMarkdownPreviewController({
  fileBridge,
  mt,
}: {
  fileBridge: MarkdownFileBridge;
  mt: LocaleText;
}) {
  const { theme } = useTheme();
  const [previewPalette, setPreviewPalette] = useState(defaultPreviewPalette);
  const [input, setInput] = useState(DEFAULT_MD);
  const [sourceFilePath, setSourceFilePath] = useState<string | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const cmTheme = useMemo(() => createCodeEditorTheme(theme), [theme]);
  const markdownLanguage = useMemo(() => markdown({ codeLanguages: markdownCodeLanguages }), []);
  const editor = useCodeMirrorTextEditor({
    value: input,
    cmTheme,
    languageExtension: markdownLanguage,
    onChange: setInput,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    dragging.current = true;
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMouseMove = (event: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = ((event.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.min(80, Math.max(20, percent)));
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
    const root = document.documentElement;
    const styles = window.getComputedStyle(root);
    setPreviewPalette(resolvePreviewPalette(theme, (key) => styles.getPropertyValue(key)));
  }, [theme]);

  const mdFilters = useMemo(
    () => [
      { name: mt('mdFiles'), extensions: ['md', 'markdown', 'txt'] },
      { name: mt('allFiles'), extensions: ['*'] },
    ],
    [mt],
  );

  const handleDownload = useCallback(() => {
    if (!input) return;
    const blob = new Blob([input], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'document.md';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [input]);

  const handleOpen = useCallback(async () => {
    if (!fileBridge.isAvailable()) {
      fileInputRef.current?.click();
      return;
    }
    const result = await fileBridge.openFile(mdFilters);
    if (result) {
      setSourceFilePath(result.filePath);
      setInput(result.content);
    }
  }, [fileBridge, mdFilters]);

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSourceFilePath(null);
    const reader = new FileReader();
    reader.onload = () => setInput(reader.result as string);
    reader.readAsText(file);
    event.target.value = '';
  }, []);

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
      const saved = await fileBridge.saveFileAs('document.md', input, mdFilters);
      if (saved) setSourceFilePath(saved);
    }
  }, [fileBridge, handleDownload, input, mdFilters, sourceFilePath]);

  const handleSaveAs = useCallback(async () => {
    if (!input) return;
    if (!fileBridge.isAvailable()) {
      handleDownload();
      return;
    }
    const saved = await fileBridge.saveFileAs('document.md', input, mdFilters);
    if (saved) setSourceFilePath(saved);
  }, [fileBridge, handleDownload, input, mdFilters]);

  const handleClear = useCallback(() => {
    setInput('');
    setSourceFilePath(null);
  }, []);

  const previewHtml = useMemo(
    () => createMarkdownPreviewHtml(input, previewPalette, theme),
    [input, previewPalette, theme],
  );

  return {
    containerRef,
    handleMouseDown,
    editorPaneProps: {
      widthPercent: splitPercent,
      fileInputRef,
      editorRef: editor.editorRef,
      showScrollTop: editor.showScrollTop,
      inputStats: getMarkdownTextStats(input),
      onOpen: () => void handleOpen(),
      onSave: () => void handleSave(),
      onSaveAs: () => void handleSaveAs(),
      onClear: handleClear,
      onFileSelect: handleFileSelect,
      onScrollTop: editor.scrollToTop,
    },
    previewPaneProps: {
      widthPercent: 100 - splitPercent,
      previewHtml,
      isDragging,
    },
  };
}
