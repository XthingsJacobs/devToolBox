import { EditorView } from '@codemirror/view';

export function createCodeEditorTheme(theme: string) {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: 'var(--font-size-base)',
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
      },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-family-mono)' },
      '.cm-content': { minHeight: '100%' },
      '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--text-quaternary)', border: 'none' },
      '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--accent-primary) 8%, transparent)' },
      '.cm-activeLineGutter': {
        backgroundColor: 'color-mix(in oklab, var(--accent-primary) 12%, transparent)',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'color-mix(in oklab, var(--accent-primary) 28%, transparent) !important',
      },
      '.cm-cursor': { borderLeftColor: 'var(--text-primary)' },
    },
    { dark: theme === 'dark' },
  );
}
