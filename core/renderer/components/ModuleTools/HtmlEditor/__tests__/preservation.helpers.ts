import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import fc from 'fast-check';

export function createHtmlEditorExtensions(onChange?: (content: string) => void) {
  return [
    lineNumbers(),
    history(),
    bracketMatching(),
    search(),
    html(),
    oneDark,
    syntaxHighlighting(defaultHighlightStyle),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
    }),
    EditorView.theme({
      '&': { height: '100%', fontSize: '13px' },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: "'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace",
      },
      '.cm-content': { minHeight: '100%' },
    }),
  ];
}

export function createEditorView(
  doc: string,
  onChange?: (content: string) => void,
): { view: EditorView; container: HTMLDivElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const state = EditorState.create({
    doc,
    extensions: createHtmlEditorExtensions(onChange),
  });
  const view = new EditorView({ state, parent: container });
  return { view, container };
}

export function destroyEditorView(view: EditorView, container: HTMLDivElement) {
  view.destroy();
  document.body.removeChild(container);
}

export const htmlContentArb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 200 }),
  fc
    .tuple(
      fc.constantFrom('p', 'div', 'span', 'h1', 'h2', 'li', 'em', 'strong'),
      fc.string({ maxLength: 100 }),
    )
    .map(([tag, text]) => `<${tag}>${text}</${tag}>`),
  fc.string({ maxLength: 80 }).map((text) => `<div><p>${text}</p></div>`),
  fc
    .string({ maxLength: 60 })
    .map((body) => `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${body}</body></html>`),
);
