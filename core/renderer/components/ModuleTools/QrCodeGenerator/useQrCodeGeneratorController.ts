import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_LOGO_RATIO,
  downloadFileName,
  shouldShowLogoSettings,
  supportsLogo,
} from './QrCodeGenerator.model';
import { renderCodeCanvas } from './QrCodeGenerator.canvas';
import type {
  CodeFormat,
  ErrorCorrectionLevel,
  LogoPosition,
  LogoShadow,
  LogoShape,
} from './QrCodeGenerator.types';

export function useQrCodeGeneratorController() {
  const [text, setText] = useState('');
  const [format, setFormat] = useState<CodeFormat>('qrcode');
  const [size, setSize] = useState(256);
  const [margin, setMargin] = useState(2);
  const [fgColor, setFgColor] = useState('#1e1e1e');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [ecLevel, setEcLevel] = useState<ErrorCorrectionLevel>('H');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoShape, setLogoShape] = useState<LogoShape>('roundRect');
  const [logoRatio, setLogoRatio] = useState(DEFAULT_LOGO_RATIO);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('center');
  const [logoShadow, setLogoShadow] = useState<LogoShadow>('shadow');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const qrConfig = useMemo(
    () => ({ text, format, size, margin, fgColor, bgColor, ecLevel }),
    [bgColor, ecLevel, fgColor, format, margin, size, text],
  );
  const logoConfig = useMemo(
    () => ({
      preview: logoPreview,
      shape: logoShape,
      ratio: logoRatio,
      position: logoPosition,
      shadow: logoShadow,
    }),
    [logoPosition, logoPreview, logoRatio, logoShadow, logoShape],
  );
  const hasLogo = supportsLogo(format);
  const showLogoSettings = shouldShowLogoSettings(format, Boolean(logoFile));

  const handleLogoChange = useCallback((file: File | null) => {
    setLogoFile(file);
    if (!file) {
      setLogoPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const removeLogo = useCallback(() => {
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  }, []);

  const generateCode = useCallback(async () => {
    if (!text.trim()) {
      setQrDataUrl(null);
      return;
    }
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      await renderCodeCanvas(canvas, qrConfig, logoConfig);
      setQrDataUrl(canvas.toDataURL('image/png'));
    } catch {
      setQrDataUrl(null);
    }
  }, [logoConfig, qrConfig, text]);

  useEffect(() => {
    void generateCode();
  }, [generateCode]);

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = downloadFileName(format);
    anchor.click();
  }, [format, qrDataUrl]);

  const handleCopy = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, 'image/png'),
      );
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      return;
    }
  }, []);

  return {
    configPaneProps: {
      text,
      format,
      size,
      margin,
      fgColor,
      bgColor,
      ecLevel,
      logoFileName: logoFile?.name ?? null,
      hasLogo,
      showLogoSettings,
      logoShape,
      logoRatio,
      logoPosition,
      logoShadow,
      logoInputRef,
      onTextChange: setText,
      onFormatChange: setFormat,
      onSizeChange: setSize,
      onMarginChange: setMargin,
      onFgColorChange: setFgColor,
      onBgColorChange: setBgColor,
      onEcLevelChange: setEcLevel,
      onLogoChange: handleLogoChange,
      onRemoveLogo: removeLogo,
      onLogoShapeChange: setLogoShape,
      onLogoRatioChange: setLogoRatio,
      onLogoPositionChange: setLogoPosition,
      onLogoShadowChange: setLogoShadow,
    },
    previewPaneProps: {
      canvasRef,
      qrDataUrl,
      copied,
      onDownload: handleDownload,
      onCopy: () => void handleCopy(),
    },
  };
}
