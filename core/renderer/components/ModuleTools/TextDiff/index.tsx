import { useCallback } from 'react';
import { getModuleLocale, useI18n } from '../../../i18n';
import { TextDiffView } from './TextDiffPanes';
import { useTextDiffController } from './useTextDiffController';

export default function TextDiff() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'TextDiff');
  const mt = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const controller = useTextDiffController({ mt });

  return <TextDiffView {...controller} mt={mt} />;
}
