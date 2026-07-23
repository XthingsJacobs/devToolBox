import { useCallback } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import { JsonFormatterInputPane } from './JsonFormatterInputPane';
import { JsonFormatterOutputPane } from './JsonFormatterOutputPane';
import styles from './JsonFormatter.module.css';
import { useJsonFormatterController } from './useJsonFormatterController';

export default function JsonFormatter() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'JsonFormatter');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const { containerRef, handleMouseDown, inputPaneProps, outputPaneProps } = useJsonFormatterController();

  return (
    <div className={styles.container} ref={containerRef}>
      <JsonFormatterInputPane {...inputPaneProps} mt={mt} />
      <div className={styles.divider} onMouseDown={handleMouseDown} />
      <JsonFormatterOutputPane {...outputPaneProps} mt={mt} />
    </div>
  );
}
