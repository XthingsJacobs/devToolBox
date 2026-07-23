import type { RefObject } from 'react';
import ResponsiveActions from '../../ResponsiveActions';
import type { LocaleText } from './QrCodeGenerator.types';
import styles from './QrCodeGenerator.module.css';

export function QrPreviewPane({
  canvasRef,
  qrDataUrl,
  copied,
  onDownload,
  onCopy,
  mt,
}: {
  canvasRef: RefObject<HTMLCanvasElement>;
  qrDataUrl: string | null;
  copied: boolean;
  onDownload: () => void;
  onCopy: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.previewPane}>
      <div className={styles.paneHeader}>
        <span>{mt('preview')}</span>
        <ResponsiveActions
          actions={[
            { label: mt('save'), onClick: onDownload },
            { label: copied ? mt('copied') : mt('copy'), onClick: onCopy },
          ]}
        />
      </div>
      <div className={styles.previewBody}>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {qrDataUrl ? (
          <img className={styles.qrImage} src={qrDataUrl} alt="QR Code" />
        ) : (
          <p className={styles.placeholder}>{mt('placeholder')}</p>
        )}
      </div>
    </div>
  );
}
