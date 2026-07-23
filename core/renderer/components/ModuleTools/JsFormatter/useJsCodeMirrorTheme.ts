import { useMemo } from 'react';
import { createCodeEditorTheme } from '../../ModuleToolShared/codeMirrorTheme';
import { useTheme } from '../../../theme';

export function useJsCodeMirrorTheme() {
  const { theme } = useTheme();

  return useMemo(() => createCodeEditorTheme(theme), [theme]);
}
