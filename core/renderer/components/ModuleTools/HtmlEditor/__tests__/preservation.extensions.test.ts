import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createEditorView, destroyEditorView, htmlContentArb } from './preservation.helpers';

describe('HtmlEditor preservation: extension configuration', () => {
  it('includes lineNumbers, history, bracketMatching, html, oneDark, syntaxHighlighting, and keymap', () => {
    fc.assert(
      fc.property(htmlContentArb, (content) => {
        const { view, container } = createEditorView(content);
        try {
          expect(container.querySelector('.cm-gutters')).not.toBeNull();
          expect(container.querySelector('.cm-lineNumbers')).not.toBeNull();
          expect(container.querySelector('.cm-content')).not.toBeNull();
          expect(container.querySelector('.cm-editor')).not.toBeNull();
          expect(view.state).toBeDefined();
          expect(view.state.doc.toString()).toBe(content);
          expect(view.state.doc.length).toBe(content.length);
        } finally {
          destroyEditorView(view, container);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('random HTML content initializes correctly and preserves document integrity', () => {
    fc.assert(
      fc.property(htmlContentArb, (content) => {
        const { view, container } = createEditorView(content);
        try {
          expect(view.state.doc.toString()).toBe(content);
          expect(view.state.doc.length).toBe(content.length);
          expect(view.state.doc.lines).toBe(content.split('\n').length);

          view.dispatch({ changes: [] });
          expect(view.state.doc.toString()).toBe(content);
        } finally {
          destroyEditorView(view, container);
        }
      }),
      { numRuns: 50 },
    );
  });
});
