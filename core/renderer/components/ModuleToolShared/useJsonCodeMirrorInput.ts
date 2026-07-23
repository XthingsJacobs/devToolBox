import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { json } from '@codemirror/lang-json';
import { bracketMatching } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';

interface UseJsonCodeMirrorInputOptions {
  active: boolean;
  value: string;
  cmTheme: Extension;
  onChange: (value: string) => void;
}

interface UseJsonCodeMirrorInputResult {
  editorHostRef: RefObject<HTMLDivElement | null>;
}

export function useJsonCodeMirrorInput({
  active,
  value,
  cmTheme,
  onChange,
}: UseJsonCodeMirrorInputOptions): UseJsonCodeMirrorInputResult {
  const themeCompartment = useMemo(() => new Compartment(), []);
  const editorHostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastValueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  const destroyEditor = useCallback(() => {
    viewRef.current?.destroy();
    viewRef.current = null;
  }, []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!active) {
      destroyEditor();
      return;
    }
    if (!editorHostRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        search(),
        json(),
        themeCompartment.of(cmTheme),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: editorHostRef.current });
    viewRef.current = view;
    return () => {
      if (viewRef.current === view) viewRef.current = null;
      view.destroy();
    };
    // Create/destroy only when JSON editor visibility changes; value/theme are synced by effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, destroyEditor, themeCompartment]);

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

  return { editorHostRef };
}
