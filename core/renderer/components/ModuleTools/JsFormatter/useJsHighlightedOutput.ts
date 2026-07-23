import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';

interface UseJsHighlightedOutputOptions {
  output: string;
  highlight: boolean;
  cmTheme: Extension;
}

export function useJsHighlightedOutput({ output, highlight, cmTheme }: UseJsHighlightedOutputOptions) {
  const themeCompartment = useMemo(() => new Compartment(), []);
  const outputEditorRef = useRef<HTMLDivElement>(null);
  const outputViewRef = useRef<EditorView | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (outputViewRef.current) {
      outputViewRef.current.destroy();
      outputViewRef.current = null;
    }
    if (!highlight || !output || !outputEditorRef.current) return;

    const state = EditorState.create({
      doc: output,
      extensions: [
        lineNumbers(),
        bracketMatching(),
        javascript(),
        themeCompartment.of(cmTheme),
        syntaxHighlighting(defaultHighlightStyle),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ],
    });
    const view = new EditorView({ state, parent: outputEditorRef.current });
    outputViewRef.current = view;

    const scroller = view.scrollDOM;
    const onScroll = () => setShowScrollTop(scroller.scrollTop > 100);
    scroller.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', onScroll);
      view.destroy();
      outputViewRef.current = null;
    };
  }, [cmTheme, highlight, output, themeCompartment]);

  useEffect(() => {
    const view = outputViewRef.current;
    if (!view) return;
    view.dispatch({ effects: themeCompartment.reconfigure(cmTheme) });
  }, [cmTheme, themeCompartment]);

  const scrollToTop = useCallback(() => {
    outputViewRef.current?.scrollDOM.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { outputEditorRef, showScrollTop, scrollToTop };
}
