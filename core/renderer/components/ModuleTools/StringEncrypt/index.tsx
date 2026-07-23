import { useCallback } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import { StringEncryptView } from './StringEncryptPanes';
import { useStringEncryptController } from './useStringEncryptController';

export default function StringEncrypt() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'StringEncrypt');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const controller = useStringEncryptController();

  return <StringEncryptView {...controller} mt={mt} />;
}
