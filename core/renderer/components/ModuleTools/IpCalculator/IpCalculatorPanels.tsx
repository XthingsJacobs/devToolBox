import type { Dispatch, SetStateAction } from 'react';
import { ToolButton, ToolInput, ToolSection } from '@@components';
import { VscClose, VscCopy } from 'react-icons/vsc';
import styles from './IpCalculator.module.css';
import { binaryIPv4, formatIPv4 } from './ipv4';
import { ResultRow } from './IpCalculatorRows';
import type { IpCalculatorTranslate, useIpCalculator } from './useIpCalculator';

type CalculatorState = ReturnType<typeof useIpCalculator>;

function ClearableInput({ value, setValue }: { value: string; setValue: Dispatch<SetStateAction<string>> }) {
  return (
    <div className={styles.inputWrap}>
      <ToolInput
        className={styles.input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        spellCheck={false}
      />
      {value ? (
        <button type="button" className={styles.clearBtn} onClick={() => setValue('')}>
          <VscClose />
        </button>
      ) : null}
    </div>
  );
}

export function SubnetPanel({ calculator, t }: { calculator: CalculatorState; t: IpCalculatorTranslate }) {
  const { cidrInput, setCidrInput, subnet } = calculator;

  return (
    <div className={styles.col}>
      <ToolSection title={t('subnetTitle')}>
        <div className={styles.block}>
          <div className={styles.hint}>{t('subnetHint')}</div>
          <div className={styles.inputRow}>
            <ClearableInput value={cidrInput} setValue={setCidrInput} />
          </div>
          {!subnet.ok ? <div className={styles.error}>{subnet.error}</div> : null}
          {subnet.ok ? (
            <div className={styles.table}>
              <ResultRow label={t('netmask')} value={`${formatIPv4(subnet.network)}/${subnet.prefix}`} />
              <ResultRow label={t('networkAddress')} value={formatIPv4(subnet.network)} />
              <ResultRow label={t('networkMask')} value={formatIPv4(subnet.mask)} />
              <ResultRow label={t('networkMaskBinary')} value={binaryIPv4(subnet.mask, true)} />
              <ResultRow label={t('cidrNotation')} value={`/${subnet.prefix}`} />
              <ResultRow label={t('wildcardMask')} value={formatIPv4(subnet.wildcard)} />
              <ResultRow label={t('networkSize')} value={String(subnet.size)} />
              <ResultRow label={t('firstAddress')} value={formatIPv4(subnet.first)} />
              <ResultRow label={t('lastAddress')} value={formatIPv4(subnet.last)} />
              <ResultRow label={t('broadcastAddress')} value={formatIPv4(subnet.broadcast)} />
              <ResultRow label={t('ipClass')} value={subnet.className} />
            </div>
          ) : null}
        </div>
      </ToolSection>
    </div>
  );
}

export function ConverterPanel({ calculator, t }: { calculator: CalculatorState; t: IpCalculatorTranslate }) {
  const { ipInput, setIpInput, converted } = calculator;

  return (
    <div className={styles.col}>
      <ToolSection title={t('converterTitle')}>
        <div className={styles.block}>
          <div className={styles.hint}>{t('converterHint')}</div>
          <div className={styles.inputRow}>
            <ClearableInput value={ipInput} setValue={setIpInput} />
          </div>
          {!converted.ok ? <div className={styles.error}>{converted.error}</div> : null}
          {converted.ok ? (
            <div className={styles.table}>
              <ResultRow label={t('decimal')} value={converted.dec} copy />
              <ResultRow label={t('hexadecimal')} value={converted.hex} copy />
              <ResultRow label={t('binary')} value={converted.bin} copy />
              <ResultRow label={t('ipv6')} value={converted.ipv6} copy />
              <ResultRow label={t('ipv6Short')} value={converted.ipv6Short} copy />
            </div>
          ) : null}
        </div>
      </ToolSection>
    </div>
  );
}

export function RangePanel({ calculator, t }: { calculator: CalculatorState; t: IpCalculatorTranslate }) {
  const { rangeStart, setRangeStart, rangeEnd, setRangeEnd, range } = calculator;

  return (
    <div className={styles.col}>
      <ToolSection title={t('rangeTitle')}>
        <div className={styles.block}>
          <div className={styles.hint}>{t('rangeHint')}</div>
          <div className={styles.inputRow}>
            <ClearableInput value={rangeStart} setValue={setRangeStart} />
            <ClearableInput value={rangeEnd} setValue={setRangeEnd} />
          </div>
          {!range.ok ? <div className={styles.error}>{range.error}</div> : null}
          {range.ok ? (
            <div className={`${styles.table} ${styles.rangeTable}`}>
              <div className={`${styles.row} ${styles.rangeHead}`}>
                <div className={styles.label} />
                <div className={styles.label}>{t('oldValue')}</div>
                <div className={styles.label}>{t('newValue')}</div>
              </div>
              <div className={styles.row}>
                <div className={styles.label}>{t('startAddress')}</div>
                <div className={styles.rangeCell}>{formatIPv4(range.oldStart)}</div>
                <div className={styles.rangeCell}>{formatIPv4(range.newStart)}</div>
              </div>
              <div className={styles.row}>
                <div className={styles.label}>{t('endAddress')}</div>
                <div className={styles.rangeCell}>{formatIPv4(range.oldEnd)}</div>
                <div className={styles.rangeCell}>{formatIPv4(range.newEnd)}</div>
              </div>
              <div className={styles.row}>
                <div className={styles.label}>{t('addressesInRange')}</div>
                <div className={styles.rangeCell}>{range.oldCount.toString()}</div>
                <div className={styles.rangeCell}>{range.newCount.toString()}</div>
              </div>
              <div className={styles.row}>
                <div className={styles.label}>{t('cidr')}</div>
                <div className={styles.rangeCell} />
                <div className={styles.rangeCell}>
                  <div className={styles.cidrInline}>
                    <span>{range.cidr}</span>
                    <ToolButton onClick={() => void navigator.clipboard.writeText(range.cidr)}>
                      <VscCopy />
                      {t('copy')}
                    </ToolButton>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </ToolSection>
    </div>
  );
}
