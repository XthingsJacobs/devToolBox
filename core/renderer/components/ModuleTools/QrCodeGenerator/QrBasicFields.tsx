import { EC_KEYS, FORMAT_KEYS } from './QrCodeGenerator.model';
import type { CodeFormat, ErrorCorrectionLevel, LocaleText } from './QrCodeGenerator.types';
import styles from './QrCodeGenerator.module.css';

export function FormatField({
  format,
  onFormatChange,
  mt,
}: {
  format: CodeFormat;
  onFormatChange: (value: CodeFormat) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{mt('format')}</label>
      <select
        className={styles.select}
        value={format}
        onChange={(event) => onFormatChange(event.target.value as CodeFormat)}
      >
        {FORMAT_KEYS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.labelKey === 'hanxin' ? mt(option.labelKey) : option.labelKey}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ContentField({
  text,
  onTextChange,
  mt,
}: {
  text: string;
  onTextChange: (value: string) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{mt('content')}</label>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={mt('contentPlaceholder')}
        rows={4}
        spellCheck={false}
      />
    </div>
  );
}

export function RangeField({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}: {value}
        {suffix}
      </label>
      <input
        type="range"
        className={styles.slider}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function ColorFields({
  fgColor,
  bgColor,
  onFgColorChange,
  onBgColorChange,
  mt,
}: {
  fgColor: string;
  bgColor: string;
  onFgColorChange: (value: string) => void;
  onBgColorChange: (value: string) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.colorRow}>
      <ColorField label={mt('fgColor')} value={fgColor} onChange={onFgColorChange} />
      <ColorField label={mt('bgColor')} value={bgColor} onChange={onBgColorChange} />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <div className={styles.colorPicker}>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <span className={styles.colorValue}>{value}</span>
      </div>
    </div>
  );
}

export function ErrorCorrectionField({
  ecLevel,
  onEcLevelChange,
  mt,
}: {
  ecLevel: ErrorCorrectionLevel;
  onEcLevelChange: (value: ErrorCorrectionLevel) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{mt('ecLevel')}</label>
      <select
        className={styles.select}
        value={ecLevel}
        onChange={(event) => onEcLevelChange(event.target.value as ErrorCorrectionLevel)}
      >
        {EC_KEYS.map((option) => (
          <option key={option.value} value={option.value}>
            {mt(option.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
