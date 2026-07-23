import { useCallback } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import { fileService } from '../../../services';
import { HtmlEditorPane, HtmlPreviewPane } from './HtmlEditorPanes';
import styles from './HtmlEditor.module.css';
import { useHtmlEditorController } from './useHtmlEditorController';

export default function HtmlEditor() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'HtmlEditor');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const { containerRef, handleMouseDown, editorPaneProps, previewPaneProps } = useHtmlEditorController({
    fileBridge: fileService,
    mt,
  });

  return (
    <div className={styles.container} ref={containerRef}>
      <HtmlEditorPane {...editorPaneProps} mt={mt} />
      <div className={styles.divider} onMouseDown={handleMouseDown} />
      <HtmlPreviewPane {...previewPaneProps} mt={mt} />
    </div>
  );
}
