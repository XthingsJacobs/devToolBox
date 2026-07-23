import { useCallback } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import { fileService } from '../../../services';
import { UuidConfigPane, UuidHelpDialog, UuidOutputPane } from './UuidGeneratorPanes';
import styles from './UuidGenerator.module.css';
import { useUuidGeneratorController } from './useUuidGeneratorController';

export default function UuidGenerator() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'UuidGenerator');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const saveTextFile = useCallback(
    (defaultName: string, content: string, filters?: { name: string; extensions: string[] }[]) =>
      fileService.saveFileAs(defaultName, content, filters),
    [],
  );
  const { configPaneProps, outputPaneProps, helpDialogProps } = useUuidGeneratorController({
    mt,
    saveTextFile,
  });

  return (
    <div className={styles.container}>
      <UuidConfigPane {...configPaneProps} mt={mt} />
      <UuidOutputPane {...outputPaneProps} mt={mt} />
      <UuidHelpDialog {...helpDialogProps} mt={mt} />
    </div>
  );
}
