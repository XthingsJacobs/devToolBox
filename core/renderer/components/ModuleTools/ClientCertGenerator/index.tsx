import { useCallback, useMemo } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import { cryptoService, fileService } from '../../../services';
import { ClientCertFormPane, ClientCertOutputPane } from './ClientCertGeneratorPanes';
import styles from './ClientCertGenerator.module.css';
import type { ClientCertBridge } from './ClientCertGenerator.types';
import { useClientCertGeneratorController } from './useClientCertGeneratorController';

export default function ClientCertGenerator() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'ClientCertGenerator');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const bridge = useMemo<ClientCertBridge>(
    () => ({
      openPemFile: (filters) => fileService.openFile(filters),
      generateClientCert: (params) => cryptoService.generateClientCert(params),
      saveFileAs: (defaultName, content, filters) => fileService.saveFileAs(defaultName, content, filters),
    }),
    [],
  );
  const controller = useClientCertGeneratorController({ mt, bridge });

  return (
    <div className={styles.container}>
      <div className={styles.body}>
        <ClientCertFormPane {...controller.formPaneProps} mt={mt} />
        <ClientCertOutputPane {...controller.outputPaneProps} mt={mt} />
      </div>
    </div>
  );
}
