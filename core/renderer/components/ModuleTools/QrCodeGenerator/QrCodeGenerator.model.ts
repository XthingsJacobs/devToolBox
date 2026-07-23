import type {
  CodeFormat,
  ErrorCorrectionLevel,
  LogoPosition,
  LogoShadow,
  LogoShape,
  OptionKey,
  QrGeneratorState,
} from './QrCodeGenerator.types';
import type { BwipRenderOptions } from './bwip-renderer';

export const FORMAT_KEYS: OptionKey<CodeFormat>[] = [
  { value: 'qrcode', labelKey: 'QR Code' },
  { value: 'hanxin', labelKey: 'hanxin' },
  { value: 'pdf417', labelKey: 'PDF417' },
  { value: 'datamatrix', labelKey: 'Data Matrix' },
];

export const EC_KEYS: OptionKey<ErrorCorrectionLevel>[] = [
  { value: 'L', labelKey: 'ecLow' },
  { value: 'M', labelKey: 'ecMedium' },
  { value: 'Q', labelKey: 'ecQuartile' },
  { value: 'H', labelKey: 'ecHigh' },
];

export const SHAPE_KEYS: OptionKey<LogoShape>[] = [
  { value: 'original', labelKey: 'shapeOriginal' },
  { value: 'rect', labelKey: 'shapeRect' },
  { value: 'roundRect', labelKey: 'shapeRoundRect' },
  { value: 'circle', labelKey: 'shapeCircle' },
];

export const POSITION_KEYS: OptionKey<LogoPosition>[] = [
  { value: 'center', labelKey: 'posCenter' },
  { value: 'bottomRight', labelKey: 'posBottomRight' },
];

export const SHADOW_KEYS: OptionKey<LogoShadow>[] = [
  { value: 'none', labelKey: 'shadowNone' },
  { value: 'shadow', labelKey: 'shadowOn' },
];

export const LOGO_FORMATS: CodeFormat[] = ['qrcode'];
export const EC_FORMATS: CodeFormat[] = ['qrcode', 'hanxin'];
export const DEFAULT_LOGO_RATIO = 0.2;

const BWIP_EC_LEVELS: Partial<Record<CodeFormat, Record<ErrorCorrectionLevel, string>>> = {
  hanxin: { L: 'L1', M: 'L2', Q: 'L3', H: 'L4' },
};

export function supportsLogo(format: CodeFormat): boolean {
  return LOGO_FORMATS.includes(format);
}

export function supportsErrorCorrection(format: CodeFormat): boolean {
  return EC_FORMATS.includes(format);
}

export function shouldShowLogoSettings(format: CodeFormat, hasLogoFile: boolean): boolean {
  return supportsLogo(format) && hasLogoFile;
}

export function colorToBwip(value: string): string {
  return value.replace('#', '');
}

export function buildBwipRenderOptions(config: QrGeneratorState): BwipRenderOptions {
  const opts: BwipRenderOptions = {
    bcid: config.format,
    text: config.text,
    scale: Math.max(2, Math.round(config.size / 100)),
    padding: config.margin * 2,
    backgroundcolor: colorToBwip(config.bgColor),
    barcolor: colorToBwip(config.fgColor),
  };
  if (supportsErrorCorrection(config.format) && config.format !== 'qrcode') {
    const mapped = BWIP_EC_LEVELS[config.format];
    if (mapped) opts.eclevel = mapped[config.ecLevel];
  }
  return opts;
}

export function downloadFileName(format: CodeFormat): string {
  return `${format}.png`;
}
