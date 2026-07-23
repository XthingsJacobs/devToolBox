import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, type KeyBinding } from '@codemirror/view';

interface UseCodeMirrorTextEditorOptions {
  value: string;
  cmTheme: Extension;
  languageExtension: Extension;
  onChange: (value: string) => void;
  extraKeymaps?: readonly KeyBinding[];
  searchEnabled?: boolean;
}

export function useCodeMirrorTextEditor({
  value,
  cmTheme,
  languageExtension,
  onChange,
  extraKeymaps = [],
  searchEnabled = false,
}: UseCodeMirrorTextEditorOptions) {
  const themeCompartment = useMemo(() => new Compartment(), []);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;
    const keyBindings = searchEnabled
      ? [...defaultKeymap, ...historyKeymap, ...searchKeymap, ...extraKeymaps]
      : [...defaultKeymap, ...historyKeymap, ...extraKeymaps];
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        ...(searchEnabled ? [search()] : []),
        languageExtension,
        themeCompartment.of(cmTheme),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of(keyBindings),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;
    const scroller = view.scrollDOM;
    const onScroll = () => setShowScrollTop(scroller.scrollTop > 100);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      view.destroy();
      viewRef.current = null;
    };
    // Initialize once; text and theme changes are synced through targeted effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: themeCompartment.reconfigure(cmTheme) });
  }, [cmTheme, themeCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current && value !== lastValueRef.current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
    lastValueRef.current = value;
  }, [value]);

  const scrollToTop = useCallback(() => {
    viewRef.current?.scrollDOM.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { editorRef, showScrollTop, scrollToTop };
}
