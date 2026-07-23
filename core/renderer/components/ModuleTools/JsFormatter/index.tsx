import { useCallback } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import { JsFormatterInputPane } from './JsFormatterInputPane';
import { JsFormatterOutputPane } from './JsFormatterOutputPane';
import styles from './JsFormatter.module.css';
import { useJsFormatterController } from './useJsFormatterController';

export { obfuscateInWorker } from './JsFormatter.operations';

export default function JsFormatter() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'JsFormatter');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const { containerRef, handleMouseDown, inputPaneProps, outputPaneProps } = useJsFormatterController();

  return (
    <div className={styles.container} ref={containerRef}>
      <JsFormatterInputPane {...inputPaneProps} mt={mt} />
      <div className={styles.divider} onMouseDown={handleMouseDown} />
      <JsFormatterOutputPane {...outputPaneProps} mt={mt} />
    </div>
  );
}
