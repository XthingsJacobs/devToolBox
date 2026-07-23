import { useCallback } from 'react';
import { useI18n, getModuleLocale } from '../../../i18n';
import { JwtDecodePanel } from './JwtDecodePanel';
import { JwtGeneratePanel } from './JwtGeneratePanel';
import { JwtHmacVerifyPanel } from './JwtHmacVerifyPanel';
import { JwtOidcPanel } from './JwtOidcPanel';
import styles from './JwtTool.module.css';

export default function JwtTool() {
  const { locale } = useI18n();
  const loc = getModuleLocale(locale, 'JwtTool');
  const mt = useCallback((key: string) => loc?.[key] ?? key, [loc]);
  const copy = useCallback((value: string) => {
    void navigator.clipboard.writeText(value);
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <JwtHmacVerifyPanel mt={mt} />
        <JwtDecodePanel mt={mt} onCopy={copy} />
      </div>
      <div className={styles.col}>
        <JwtOidcPanel mt={mt} onCopy={copy} />
      </div>
      <div className={styles.col}>
        <JwtGeneratePanel mt={mt} onCopy={copy} />
      </div>
    </div>
  );
}
