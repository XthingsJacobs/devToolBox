import { useCallback } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import { QrConfigPane, QrPreviewPane } from './QrCodeGeneratorPanes';
import styles from './QrCodeGenerator.module.css';
import { useQrCodeGeneratorController } from './useQrCodeGeneratorController';

export default function QrCodeGenerator() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'QrCodeGenerator');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const controller = useQrCodeGeneratorController();

  return (
    <div className={styles.container}>
      <QrConfigPane {...controller.configPaneProps} mt={mt} />
      <QrPreviewPane {...controller.previewPaneProps} mt={mt} />
    </div>
  );
}
