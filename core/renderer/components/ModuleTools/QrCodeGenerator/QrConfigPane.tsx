import type { RefObject } from 'react';
import { supportsErrorCorrection } from './QrCodeGenerator.model';
import type {
  CodeFormat,
  ErrorCorrectionLevel,
  LocaleText,
  LogoPosition,
  LogoShadow,
  LogoShape,
} from './QrCodeGenerator.types';
import { ColorFields, ContentField, ErrorCorrectionField, FormatField, RangeField } from './QrBasicFields';
import { LogoFields } from './QrLogoFields';
import styles from './QrCodeGenerator.module.css';

export function QrConfigPane({
  text,
  format,
  size,
  margin,
  fgColor,
  bgColor,
  ecLevel,
  logoFileName,
  hasLogo,
  showLogoSettings,
  logoShape,
  logoRatio,
  logoPosition,
  logoShadow,
  logoInputRef,
  onTextChange,
  onFormatChange,
  onSizeChange,
  onMarginChange,
  onFgColorChange,
  onBgColorChange,
  onEcLevelChange,
  onLogoChange,
  onRemoveLogo,
  onLogoShapeChange,
  onLogoRatioChange,
  onLogoPositionChange,
  onLogoShadowChange,
  mt,
}: {
  text: string;
  format: CodeFormat;
  size: number;
  margin: number;
  fgColor: string;
  bgColor: string;
  ecLevel: ErrorCorrectionLevel;
  logoFileName: string | null;
  hasLogo: boolean;
  showLogoSettings: boolean;
  logoShape: LogoShape;
  logoRatio: number;
  logoPosition: LogoPosition;
  logoShadow: LogoShadow;
  logoInputRef: RefObject<HTMLInputElement>;
  onTextChange: (value: string) => void;
  onFormatChange: (value: CodeFormat) => void;
  onSizeChange: (value: number) => void;
  onMarginChange: (value: number) => void;
  onFgColorChange: (value: string) => void;
  onBgColorChange: (value: string) => void;
  onEcLevelChange: (value: ErrorCorrectionLevel) => void;
  onLogoChange: (file: File | null) => void;
  onRemoveLogo: () => void;
  onLogoShapeChange: (value: LogoShape) => void;
  onLogoRatioChange: (value: number) => void;
  onLogoPositionChange: (value: LogoPosition) => void;
  onLogoShadowChange: (value: LogoShadow) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.configPane}>
      <div className={styles.paneHeader}>
        <span>{mt('config')}</span>
      </div>
      <div className={styles.configBody}>
        <FormatField format={format} onFormatChange={onFormatChange} mt={mt} />
        <ContentField text={text} onTextChange={onTextChange} mt={mt} />
        <RangeField
          label={mt('size')}
          value={size}
          suffix="px"
          min={128}
          max={1024}
          step={8}
          onChange={onSizeChange}
        />
        <RangeField label={mt('margin')} value={margin} min={0} max={10} step={1} onChange={onMarginChange} />
        <ColorFields
          fgColor={fgColor}
          bgColor={bgColor}
          onFgColorChange={onFgColorChange}
          onBgColorChange={onBgColorChange}
          mt={mt}
        />
        {supportsErrorCorrection(format) && (
          <ErrorCorrectionField ecLevel={ecLevel} onEcLevelChange={onEcLevelChange} mt={mt} />
        )}
        {hasLogo && (
          <LogoFields
            logoFileName={logoFileName}
            showLogoSettings={showLogoSettings}
            logoShape={logoShape}
            logoRatio={logoRatio}
            logoPosition={logoPosition}
            logoShadow={logoShadow}
            logoInputRef={logoInputRef}
            onLogoChange={onLogoChange}
            onRemoveLogo={onRemoveLogo}
            onLogoShapeChange={onLogoShapeChange}
            onLogoRatioChange={onLogoRatioChange}
            onLogoPositionChange={onLogoPositionChange}
            onLogoShadowChange={onLogoShadowChange}
            mt={mt}
          />
        )}
      </div>
    </div>
  );
}
