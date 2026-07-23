import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';

interface UseJsInputEditorOptions {
  input: string;
  cmTheme: Extension;
  onInputChange: (value: string) => void;
}

export function useJsInputEditor({ input, cmTheme, onInputChange }: UseJsInputEditorOptions) {
  const themeCompartment = useMemo(() => new Compartment(), []);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastInputRef = useRef(input);
  const onInputChangeRef = useRef(onInputChange);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    onInputChangeRef.current = onInputChange;
  }, [onInputChange]);

  useEffect(() => {
    if (!editorRef.current) return;
    const state = EditorState.create({
      doc: input,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        javascript(),
        themeCompartment.of(cmTheme),
        syntaxHighlighting(defaultHighlightStyle),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onInputChangeRef.current(update.state.doc.toString());
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
    // Keep CodeMirror initialization one-shot; theme changes are handled by compartment reconfiguration.
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
    if (input !== current && input !== lastInputRef.current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: input } });
    }
    lastInputRef.current = input;
  }, [input]);

  const scrollToTop = useCallback(() => {
    viewRef.current?.scrollDOM.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { editorRef, showScrollTop, scrollToTop };
}
