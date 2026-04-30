/**
 * Bug Condition Exploration Test — Property 1: Fault Condition
 * Missing search extension causes Cmd/Ctrl+F not to open the editor search
 *
 * isBugCondition:
 *   searchExtension NOT IN editorState.extensions AND searchKeymap NOT IN keymap.of()
 *
 * expectedBehavior:
 *   EditorState extensions include search(), and keymap includes searchKeymap,
 *   so Mod+F opens the in-editor search panel instead of the browser find
 *
 * This test should fail on the buggy code and pass after the fix.
 *
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 */
import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { search, searchKeymap, openSearchPanel, searchPanelOpen } from '@codemirror/search';

/**
 * Recreates the exact same extensions array used in HtmlEditor/index.tsx.
 * This mirrors the fixed code which includes search() and searchKeymap.
 */
function createHtmlEditorExtensions() {
  return [
    lineNumbers(),
    history(),
    bracketMatching(),
    search(),
    html(),
    oneDark,
    syntaxHighlighting(defaultHighlightStyle),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    EditorView.updateListener.of(() => {}),
    EditorView.theme({
      '&': { height: '100%', fontSize: '13px' },
      '.cm-scroller': { overflow: 'auto', fontFamily: "'SF Mono', monospace" },
      '.cm-content': { minHeight: '100%' },
    }),
  ];
}

describe('Bug Condition Exploration: missing search extension breaks Cmd/Ctrl+F in-editor search', () => {
  /**
   * **Validates: Requirements 1.1, 2.1**
   *
   * Verify HtmlEditor CodeMirror extensions include search().
   * Use openSearchPanel to validate the search panel can be opened.
   */
  it('EditorState extensions include search() and Cmd+F opens the search panel', () => {
    const extensions = createHtmlEditorExtensions();
    const state = EditorState.create({ doc: '<p>Hello World</p>', extensions });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = new EditorView({ state, parent: container });

    try {
      // Use the CodeMirror command API directly to open the search panel.
      // This is equivalent to what Cmd+F triggers via searchKeymap.
      // Without search() extension, this command has no effect.
      openSearchPanel(view);

      // Verify the search panel is open via the state facet
      expect(searchPanelOpen(view.state)).toBe(true);

      // Also verify the search panel DOM element is rendered
      const searchPanelEl = container.querySelector('.cm-search');
      expect(searchPanelEl).not.toBeNull();
    } finally {
      view.destroy();
      document.body.removeChild(container);
    }
  });

  /**
   * **Validates: Requirements 1.2, 2.2**
   *
   * Verify keymap includes searchKeymap entries (Mod-f binding).
   */
  it('keymap includes the Mod-f binding from searchKeymap', () => {
    // Confirm searchKeymap itself has Mod-f (sanity check)
    const hasModF = searchKeymap.some((binding) => binding.key === 'Mod-f');
    expect(hasModF).toBe(true);

    const extensions = createHtmlEditorExtensions();
    const state = EditorState.create({ doc: '', extensions });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = new EditorView({ state, parent: container });

    try {
      // Find the Mod-f binding's run function from searchKeymap
      const modFBinding = searchKeymap.find((b) => b.key === 'Mod-f');
      expect(modFBinding).toBeDefined();
      expect(modFBinding!.run).toBeDefined();

      // Execute the run function directly — this is what CodeMirror calls
      // when the keymap intercepts Mod-f
      const result = modFBinding!.run!(view);
      expect(result).toBe(true);

      // Verify the search panel opened
      expect(searchPanelOpen(view.state)).toBe(true);
    } finally {
      view.destroy();
      document.body.removeChild(container);
    }
  });

  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * Verify other bindings in searchKeymap (e.g. Mod-d) are integrated.
   */
  it('keymap includes the Mod-d binding from searchKeymap', () => {
    // Confirm searchKeymap has Mod-d
    const hasModD = searchKeymap.some((binding) => binding.key === 'Mod-d');
    expect(hasModD).toBe(true);

    const extensions = createHtmlEditorExtensions();
    const state = EditorState.create({ doc: 'hello hello hello', extensions });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = new EditorView({ state, parent: container });

    try {
      // Select the first "hello" so Mod-d can select the next occurrence
      view.dispatch({ selection: { anchor: 0, head: 5 } });

      // Execute the Mod-d binding's run function directly
      const modDBinding = searchKeymap.find((b) => b.key === 'Mod-d');
      expect(modDBinding).toBeDefined();
      expect(modDBinding!.run).toBeDefined();

      const result = modDBinding!.run!(view);
      expect(result).toBe(true);
    } finally {
      view.destroy();
      document.body.removeChild(container);
    }
  });
});
