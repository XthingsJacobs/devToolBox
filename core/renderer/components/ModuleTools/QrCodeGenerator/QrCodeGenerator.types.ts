export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type CodeFormat = 'qrcode' | 'hanxin' | 'pdf417' | 'datamatrix';
export type LogoShape = 'original' | 'rect' | 'roundRect' | 'circle';
export type LogoPosition = 'center' | 'bottomRight';
export type LogoShadow = 'none' | 'shadow';
export type LocaleText = (key: string) => string;

export interface OptionKey<TValue extends string> {
  value: TValue;
  labelKey: string;
}

export interface QrGeneratorState {
  text: string;
  format: CodeFormat;
  size: number;
  margin: number;
  fgColor: string;
  bgColor: string;
  ecLevel: ErrorCorrectionLevel;
}

export interface LogoConfig {
  preview: string | null;
  shape: LogoShape;
  ratio: number;
  position: LogoPosition;
  shadow: LogoShadow;
}
