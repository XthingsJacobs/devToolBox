import type { ChangeEvent, RefObject } from 'react';
import { DEFAULT_LOGO_RATIO, POSITION_KEYS, SHADOW_KEYS, SHAPE_KEYS } from './QrCodeGenerator.model';
import type { LocaleText, LogoPosition, LogoShadow, LogoShape } from './QrCodeGenerator.types';
import styles from './QrCodeGenerator.module.css';

export function LogoFields({
  logoFileName,
  showLogoSettings,
  logoShape,
  logoRatio,
  logoPosition,
  logoShadow,
  logoInputRef,
  onLogoChange,
  onRemoveLogo,
  onLogoShapeChange,
  onLogoRatioChange,
  onLogoPositionChange,
  onLogoShadowChange,
  mt,
}: {
  logoFileName: string | null;
  showLogoSettings: boolean;
  logoShape: LogoShape;
  logoRatio: number;
  logoPosition: LogoPosition;
  logoShadow: LogoShadow;
  logoInputRef: RefObject<HTMLInputElement>;
  onLogoChange: (file: File | null) => void;
  onRemoveLogo: () => void;
  onLogoShapeChange: (value: LogoShape) => void;
  onLogoRatioChange: (value: number) => void;
  onLogoPositionChange: (value: LogoPosition) => void;
  onLogoShadowChange: (value: LogoShadow) => void;
  mt: LocaleText;
}) {
  return (
    <>
      <div className={styles.field}>
        <label className={styles.label}>{mt('logo')}</label>
        <div className={styles.logoRow}>
          <button className={styles.fileBtn} onClick={() => logoInputRef.current?.click()}>
            {mt('selectFile')}
          </button>
          {logoFileName && (
            <>
              <span className={styles.fileName}>{logoFileName}</span>
              <button className={styles.removeBtn} onClick={onRemoveLogo}>
                ✕
              </button>
            </>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onLogoChange(event.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
        </div>
      </div>
      {showLogoSettings && (
        <LogoSettings
          logoShape={logoShape}
          logoRatio={logoRatio}
          logoPosition={logoPosition}
          logoShadow={logoShadow}
          onLogoShapeChange={onLogoShapeChange}
          onLogoRatioChange={onLogoRatioChange}
          onLogoPositionChange={onLogoPositionChange}
          onLogoShadowChange={onLogoShadowChange}
          mt={mt}
        />
      )}
    </>
  );
}

function LogoSettings({
  logoShape,
  logoRatio,
  logoPosition,
  logoShadow,
  onLogoShapeChange,
  onLogoRatioChange,
  onLogoPositionChange,
  onLogoShadowChange,
  mt,
}: {
  logoShape: LogoShape;
  logoRatio: number;
  logoPosition: LogoPosition;
  logoShadow: LogoShadow;
  onLogoShapeChange: (value: LogoShape) => void;
  onLogoRatioChange: (value: number) => void;
  onLogoPositionChange: (value: LogoPosition) => void;
  onLogoShadowChange: (value: LogoShadow) => void;
  mt: LocaleText;
}) {
  return (
    <>
      <div className={styles.twoCol}>
        <OptionField
          label={mt('shape')}
          value={logoShape}
          options={SHAPE_KEYS}
          onChange={onLogoShapeChange}
          mt={mt}
        />
        <div className={styles.field}>
          <label className={styles.label}>
            {mt('logoSize')}: {Math.round(logoRatio * 100)}%
            <button className={styles.resetBtn} onClick={() => onLogoRatioChange(DEFAULT_LOGO_RATIO)}>
              {mt('reset')}
            </button>
          </label>
          <input
            type="range"
            className={styles.slider}
            min={0.1}
            max={0.35}
            step={0.01}
            value={logoRatio}
            onChange={(event) => onLogoRatioChange(Number(event.target.value))}
          />
        </div>
      </div>
      <div className={styles.twoCol}>
        <OptionField
          label={mt('position')}
          value={logoPosition}
          options={POSITION_KEYS}
          onChange={onLogoPositionChange}
          mt={mt}
        />
        <OptionField
          label={mt('shadow')}
          value={logoShadow}
          options={SHADOW_KEYS}
          onChange={onLogoShadowChange}
          mt={mt}
        />
      </div>
    </>
  );
}

function OptionField<TValue extends string>({
  label,
  value,
  options,
  onChange,
  mt,
}: {
  label: string;
  value: TValue;
  options: { value: TValue; labelKey: string }[];
  onChange: (value: TValue) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <select
        className={styles.select}
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {mt(option.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
