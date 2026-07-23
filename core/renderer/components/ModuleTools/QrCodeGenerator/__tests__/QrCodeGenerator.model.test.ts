import { describe, expect, it } from 'vitest';
import {
  buildBwipRenderOptions,
  colorToBwip,
  downloadFileName,
  shouldShowLogoSettings,
  supportsErrorCorrection,
  supportsLogo,
} from '../QrCodeGenerator.model';

const baseConfig = {
  text: 'hello',
  format: 'hanxin' as const,
  size: 256,
  margin: 2,
  fgColor: '#1e1e1e',
  bgColor: '#ffffff',
  ecLevel: 'H' as const,
};

describe('QrCodeGenerator model', () => {
  it('detects format capabilities', () => {
    expect(supportsLogo('qrcode')).toBe(true);
    expect(supportsLogo('pdf417')).toBe(false);
    expect(supportsErrorCorrection('qrcode')).toBe(true);
    expect(supportsErrorCorrection('hanxin')).toBe(true);
    expect(supportsErrorCorrection('datamatrix')).toBe(false);
    expect(shouldShowLogoSettings('qrcode', true)).toBe(true);
    expect(shouldShowLogoSettings('qrcode', false)).toBe(false);
    expect(shouldShowLogoSettings('pdf417', true)).toBe(false);
  });

  it('normalizes colors and output names', () => {
    expect(colorToBwip('#ffffff')).toBe('ffffff');
    expect(colorToBwip('ffffff')).toBe('ffffff');
    expect(downloadFileName('datamatrix')).toBe('datamatrix.png');
  });

  it('builds BWIP options with scaled size, padding and Han Xin error correction', () => {
    expect(buildBwipRenderOptions(baseConfig)).toMatchObject({
      bcid: 'hanxin',
      text: 'hello',
      scale: 3,
      padding: 4,
      backgroundcolor: 'ffffff',
      barcolor: '1e1e1e',
      eclevel: 'L4',
    });
  });

  it('omits BWIP error correction for unsupported formats', () => {
    const options = buildBwipRenderOptions({ ...baseConfig, format: 'pdf417' });

    expect(options.eclevel).toBeUndefined();
    expect(options.scale).toBe(3);
  });

  it('keeps a minimum BWIP scale', () => {
    expect(buildBwipRenderOptions({ ...baseConfig, size: 128 }).scale).toBe(2);
  });
});
