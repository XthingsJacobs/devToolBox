import { useCallback } from 'react';
import styles from './IpCalculator.module.css';
import { getModuleLocale, useI18n } from '../../../i18n';
import { ConverterPanel, RangePanel, SubnetPanel } from './IpCalculatorPanels';
import { useIpCalculator } from './useIpCalculator';

export default function IpCalculator() {
  const { locale } = useI18n();
  const localeData = getModuleLocale(locale, 'IpCalculator');
  const t = useCallback((key: string) => localeData?.[key] ?? key, [localeData]);
  const calculator = useIpCalculator(t);

  return (
    <div className={styles.wrap}>
      <SubnetPanel calculator={calculator} t={t} />
      <ConverterPanel calculator={calculator} t={t} />
      <RangePanel calculator={calculator} t={t} />
    </div>
  );
}
