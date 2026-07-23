import { useCallback } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import { fileService } from '../../../services';
import { MarkdownEditorPane, MarkdownPreviewPane } from './MarkdownPreviewPanes';
import styles from './MarkdownPreview.module.css';
import { useMarkdownPreviewController } from './useMarkdownPreviewController';

export default function MarkdownPreview() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'MarkdownPreview');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const { containerRef, handleMouseDown, editorPaneProps, previewPaneProps } = useMarkdownPreviewController({
    fileBridge: fileService,
    mt,
  });

  return (
    <div className={styles.container} ref={containerRef}>
      <MarkdownEditorPane {...editorPaneProps} mt={mt} />
      <div className={styles.divider} onMouseDown={handleMouseDown} />
      <MarkdownPreviewPane {...previewPaneProps} mt={mt} />
    </div>
  );
}
