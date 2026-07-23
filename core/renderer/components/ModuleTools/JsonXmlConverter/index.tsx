import { useCallback } from 'react';
import type { FileFilter } from '@devtoolbox/core';
import { getModuleLocale, useI18n } from '../../../i18n';
import { fileService } from '../../../services';
import { JsonXmlInputPane, JsonXmlOutputPane } from './JsonXmlConverterPanes';
import styles from './JsonXmlConverter.module.css';
import { useJsonXmlConverterController } from './useJsonXmlConverterController';

export default function JsonXmlConverter() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'JsonXmlConverter');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const openFile = useCallback((filters: FileFilter[]) => fileService.openFile(filters), []);
  const { containerRef, handleMouseDown, inputPaneProps, outputPaneProps } = useJsonXmlConverterController({
    openFile,
    mt,
  });

  return (
    <div className={styles.container} ref={containerRef}>
      <JsonXmlInputPane {...inputPaneProps} mt={mt} />
      <div className={styles.divider} onMouseDown={handleMouseDown} />
      <JsonXmlOutputPane {...outputPaneProps} mt={mt} />
    </div>
  );
}
