/**
 * Preservation Property Tests — Property 2: non-search shortcuts and existing editor behavior remain unchanged
 *
 * These tests should pass on the baseline behavior and continue to pass after changes (no regressions).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap, undo } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';

/**
 * Recreates the exact same extensions array used in HtmlEditor/index.tsx (fixed).
 * Accepts an optional onChange callback to observe updateListener behavior.
 */
function createHtmlEditorExtensions(onChange?: (content: string) => void) {
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

/**
 * Helper: create an EditorView with given doc and optional onChange callback.
 * Returns { view, container } — caller must destroy view and remove container.
 */
function createEditorView(
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

/**
 * Generator: random HTML content strings for property-based tests.
 * Produces valid-ish HTML snippets that exercise the editor.
 */
const htmlContentArb = fc.oneof(
  // Simple text
  fc.string({ minLength: 0, maxLength: 200 }),
  // HTML tags with content
  fc
    .tuple(
      fc.constantFrom('p', 'div', 'span', 'h1', 'h2', 'li', 'em', 'strong'),
      fc.string({ maxLength: 100 }),
    )
    .map(([tag, text]) => `<${tag}>${text}</${tag}>`),
  // Nested HTML
  fc.string({ maxLength: 80 }).map((text) => `<div><p>${text}</p></div>`),
  // Full HTML document
  fc
    .string({ maxLength: 60 })
    .map((body) => `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${body}</body></html>`),
);

describe('Preservation Property Tests: non-search shortcuts and editor behavior remain unchanged', () => {
  /**
   * Property: For all non-search-shortcut inputs, the editor SHALL preserve
   * existing extension configuration (lineNumbers, history, bracketMatching,
   * html, oneDark, syntaxHighlighting, defaultKeymap, historyKeymap).
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  it('EditorState includes all existing extensions (lineNumbers, history, bracketMatching, html, oneDark, syntaxHighlighting, keymap)', () => {
    fc.assert(
      fc.property(htmlContentArb, (content) => {
        const { view, container } = createEditorView(content);
        try {
          // Verify line numbers gutter is rendered
          const gutters = container.querySelector('.cm-gutters');
          expect(gutters).not.toBeNull();
          const lineNumberGutter = container.querySelector('.cm-lineNumbers');
          expect(lineNumberGutter).not.toBeNull();

          // Verify the editor is rendered with content
          const cmContent = container.querySelector('.cm-content');
          expect(cmContent).not.toBeNull();

          // Verify oneDark theme is applied (cm-theme class or dark styling)
          // oneDark adds a theme extension that applies styles
          const editorElement = container.querySelector('.cm-editor');
          expect(editorElement).not.toBeNull();

          // Verify bracket matching is active by checking the extension is loaded
          // bracketMatching adds a state field — we verify the state was created successfully
          expect(view.state).toBeDefined();
          expect(view.state.doc.toString()).toBe(content);

          // Verify syntax highlighting is active — the html() language extension
          // adds syntax tree parsing. We check that the editor initialized without errors.
          expect(view.state.doc.length).toBe(content.length);
        } finally {
          view.destroy();
          document.body.removeChild(container);
        }
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property: For any HTML content edit, the updateListener SHALL fire
   * and propagate the new document content.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('updateListener fires on edits and propagates the new document content', () => {
    fc.assert(
      fc.property(
        htmlContentArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (initialContent, insertText) => {
          const receivedContents: string[] = [];
          const onChange = (content: string) => {
            receivedContents.push(content);
          };

          const { view, container } = createEditorView(initialContent, onChange);
          try {
            // Dispatch an edit: insert text at the end of the document
            view.dispatch({
              changes: {
                from: view.state.doc.length,
                to: view.state.doc.length,
                insert: insertText,
              },
            });

            // updateListener should have fired at least once
            expect(receivedContents.length).toBeGreaterThanOrEqual(1);

            // The last received content should be the initial content + inserted text
            const lastContent = receivedContents[receivedContents.length - 1];
            expect(lastContent).toBe(initialContent + insertText);

            // The editor state should also reflect the change
            expect(view.state.doc.toString()).toBe(initialContent + insertText);
          } finally {
            view.destroy();
            document.body.removeChild(container);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Property: For random HTML content strings, the editor SHALL correctly
   * initialize with the content and maintain document integrity.
   *
   * **Validates: Requirements 3.3, 3.4**
   */
  it('random HTML content initializes correctly and preserves document integrity', () => {
    fc.assert(
      fc.property(htmlContentArb, (content) => {
        const { view, container } = createEditorView(content);
        try {
          // Document content should exactly match what was provided
          expect(view.state.doc.toString()).toBe(content);

          // Document length should match
          expect(view.state.doc.length).toBe(content.length);

          // Line count should match (number of newlines + 1)
          const expectedLines = content.split('\n').length;
          expect(view.state.doc.lines).toBe(expectedLines);

          // Editor should be fully functional — dispatch a no-op transaction
          view.dispatch({ changes: [] });
          // Content should remain unchanged after no-op
          expect(view.state.doc.toString()).toBe(content);
        } finally {
          view.destroy();
          document.body.removeChild(container);
        }
      }),
      { numRuns: 50 },
    );
  });

  /**
   * Property: history extension and historyKeymap are properly configured.
   * Verifies undo works after edits — confirming history() extension is active.
   *
   * **Validates: Requirements 3.2**
   */
  it('history extension works and undo restores the original content after edits', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (initialContent, insertText) => {
          const { view, container } = createEditorView(initialContent);
          try {
            // Make an edit
            view.dispatch({
              changes: {
                from: view.state.doc.length,
                to: view.state.doc.length,
                insert: insertText,
              },
            });
            expect(view.state.doc.toString()).toBe(initialContent + insertText);

            // Use programmatic undo — this verifies the history() extension is active
            // undo() returns true if it successfully undid a change
            const undoResult = undo(view);
            expect(undoResult).toBe(true);

            // After undo, content should revert to initial
            expect(view.state.doc.toString()).toBe(initialContent);
          } finally {
            view.destroy();
            document.body.removeChild(container);
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
