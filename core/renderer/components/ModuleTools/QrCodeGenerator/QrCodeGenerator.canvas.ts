import QRCode from 'qrcode';
import { buildBwipRenderOptions, supportsLogo } from './QrCodeGenerator.model';
import type { CodeFormat, LogoConfig, QrGeneratorState } from './QrCodeGenerator.types';

interface LogoLayout {
  logoSize: number;
  pad: number;
  totalSize: number;
  x: number;
  y: number;
  lx: number;
  ly: number;
}

function resolveLogoLayout(canvas: HTMLCanvasElement, logo: LogoConfig): LogoLayout {
  const logoSize = canvas.width * logo.ratio;
  const isOriginal = logo.shape === 'original';
  const pad = isOriginal ? 0 : canvas.width * 0.03;
  const totalSize = logoSize + pad * 2;
  const x =
    logo.position === 'bottomRight'
      ? canvas.width - totalSize - canvas.width * 0.02
      : (canvas.width - totalSize) / 2;
  const y =
    logo.position === 'bottomRight'
      ? canvas.height - totalSize - canvas.height * 0.02
      : (canvas.height - totalSize) / 2;

  return { logoSize, pad, totalSize, x, y, lx: x + pad, ly: y + pad };
}

function traceLogoShape(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  shape: LogoConfig['shape'],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.beginPath();
  if (shape === 'circle') {
    const radius = width / 2;
    ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
  } else if (shape === 'roundRect') {
    ctx.roundRect(x, y, width, height, canvas.width * 0.02);
  } else if (shape === 'rect') {
    ctx.rect(x, y, width, height);
  }
}

function drawFramedLogo(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  logo: LogoConfig,
  bgColor: string,
) {
  const { logoSize, totalSize, x, y, lx, ly } = resolveLogoLayout(canvas, logo);
  const clearPad = canvas.width * 0.02;

  traceLogoShape(
    ctx,
    canvas,
    logo.shape,
    x - clearPad,
    y - clearPad,
    totalSize + clearPad * 2,
    totalSize + clearPad * 2,
  );
  ctx.fillStyle = bgColor;
  ctx.fill();

  if (logo.shadow === 'shadow') {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = canvas.width * 0.025;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = canvas.width * 0.004;
  }

  traceLogoShape(ctx, canvas, logo.shape, x, y, totalSize, totalSize);
  ctx.fillStyle = bgColor;
  ctx.fill();
  if (logo.shadow === 'shadow') ctx.restore();

  traceLogoShape(ctx, canvas, logo.shape, x, y, totalSize, totalSize);
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = Math.max(1, canvas.width * 0.003);
  ctx.stroke();

  ctx.save();
  traceLogoShape(ctx, canvas, logo.shape, lx, ly, logoSize, logoSize);
  ctx.clip();
  ctx.drawImage(image, lx, ly, logoSize, logoSize);
  ctx.restore();
}

function drawOriginalLogo(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  logo: LogoConfig,
) {
  const { logoSize, lx, ly } = resolveLogoLayout(canvas, logo);
  if (logo.shadow === 'shadow') {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = canvas.width * 0.02;
    ctx.shadowOffsetX = canvas.width * 0.005;
    ctx.shadowOffsetY = canvas.width * 0.005;
  }
  ctx.drawImage(image, lx, ly, logoSize, logoSize);
  if (logo.shadow === 'shadow') ctx.restore();
}

export function drawLogo(
  canvas: HTMLCanvasElement,
  format: CodeFormat,
  logo: LogoConfig,
  bgColor: string,
): Promise<void> {
  return new Promise((resolve) => {
    if (!logo.preview || !supportsLogo(format)) {
      resolve();
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve();
      return;
    }

    const image = new Image();
    image.onload = () => {
      if (logo.shape === 'original') drawOriginalLogo(ctx, canvas, image, logo);
      else drawFramedLogo(ctx, canvas, image, logo, bgColor);
      resolve();
    };
    image.onerror = () => resolve();
    image.src = logo.preview;
  });
}

export async function renderCodeCanvas(
  canvas: HTMLCanvasElement,
  config: QrGeneratorState,
  logo: LogoConfig,
): Promise<void> {
  if (config.format === 'qrcode') {
    await QRCode.toCanvas(canvas, config.text, {
      width: config.size,
      margin: config.margin,
      color: { dark: config.fgColor, light: config.bgColor },
      errorCorrectionLevel: config.ecLevel,
    });
    await drawLogo(canvas, config.format, logo, config.bgColor);
    return;
  }

  const { renderBarcode } = await import('./bwip-renderer');
  renderBarcode(canvas, buildBwipRenderOptions(config));
}
