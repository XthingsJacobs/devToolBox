import { useCallback } from 'react';
import type { FileFilter } from '@devtoolbox/core';
import { getModuleLocale, useI18n } from '../../../i18n';
import { fileService } from '../../../services';
import { JsonYamlInputPane, JsonYamlOutputPane } from './JsonYamlConverterPanes';
import styles from './JsonYamlConverter.module.css';
import { useJsonYamlConverterController } from './useJsonYamlConverterController';

export default function JsonYamlConverter() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'JsonYamlConverter');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const openFile = useCallback((filters: FileFilter[]) => fileService.openFile(filters), []);
  const { containerRef, handleMouseDown, inputPaneProps, outputPaneProps } = useJsonYamlConverterController({
    openFile,
    mt,
  });

  return (
    <div className={styles.container} ref={containerRef}>
      <JsonYamlInputPane {...inputPaneProps} mt={mt} />
      <div className={styles.divider} onMouseDown={handleMouseDown} />
      <JsonYamlOutputPane {...outputPaneProps} mt={mt} />
    </div>
  );
}
