import { undo } from '@codemirror/commands';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createEditorView, destroyEditorView, htmlContentArb } from './preservation.helpers';

describe('HtmlEditor preservation: editing behavior', () => {
  it('updateListener fires on edits and propagates the new document content', () => {
    fc.assert(
      fc.property(
        htmlContentArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (initialContent, insertText) => {
          const receivedContents: string[] = [];
          const { view, container } = createEditorView(initialContent, (content) =>
            receivedContents.push(content),
          );
          try {
            view.dispatch({
              changes: {
                from: view.state.doc.length,
                to: view.state.doc.length,
                insert: insertText,
              },
            });

            expect(receivedContents.length).toBeGreaterThanOrEqual(1);
            expect(receivedContents[receivedContents.length - 1]).toBe(initialContent + insertText);
            expect(view.state.doc.toString()).toBe(initialContent + insertText);
          } finally {
            destroyEditorView(view, container);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('history extension works and undo restores the original content after edits', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (initialContent, insertText) => {
          const { view, container } = createEditorView(initialContent);
          try {
            view.dispatch({
              changes: {
                from: view.state.doc.length,
                to: view.state.doc.length,
                insert: insertText,
              },
            });
            expect(view.state.doc.toString()).toBe(initialContent + insertText);
            expect(undo(view)).toBe(true);
            expect(view.state.doc.toString()).toBe(initialContent);
          } finally {
            destroyEditorView(view, container);
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
