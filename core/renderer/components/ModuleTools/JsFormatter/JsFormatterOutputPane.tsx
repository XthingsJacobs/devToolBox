import type { RefObject } from 'react';
import { VscCopy, VscOutput } from 'react-icons/vsc';
import { ToolSection } from '@@components';
import ResponsiveActions from '../../ResponsiveActions';
import { ScrollTopButton, StatsBar } from './JsFormatterBlocks';
import type { JsTextStats, LocaleText } from './JsFormatter.types';
import styles from './JsFormatter.module.css';

export function JsFormatterOutputPane({
  widthPercent,
  output,
  error,
  processing,
  highlight,
  copied,
  outputStats,
  outputRef,
  outputEditorRef,
  showOutputScrollTop,
  onCopy,
  onOutputScrollTop,
  mt,
}: {
  widthPercent: number;
  output: string;
  error: string;
  processing: boolean;
  highlight: boolean;
  copied: boolean;
  outputStats: JsTextStats;
  outputRef: RefObject<HTMLDivElement | null>;
  outputEditorRef: RefObject<HTMLDivElement | null>;
  showOutputScrollTop: boolean;
  onCopy: () => void;
  onOutputScrollTop: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.outputPane} style={{ width: `${widthPercent}%` }}>
      <ToolSection
        fill
        bodyVariant="noPad"
        title={mt('result')}
        icon={<VscOutput />}
        actions={
          <ResponsiveActions
            actions={[{ label: copied ? mt('copied') : mt('copy'), onClick: onCopy, icon: <VscCopy /> }]}
          />
        }
      >
        <div className={styles.outputBody}>
          {processing ? (
            <div className={styles.processing}>{mt('processing')}</div>
          ) : error ? (
            <div className={styles.outputContent} ref={outputRef as RefObject<HTMLDivElement>}>
              <pre className={styles.error}>{error}</pre>
            </div>
          ) : highlight && output ? (
            <div className={styles.editorBody} ref={outputEditorRef as RefObject<HTMLDivElement>} />
          ) : output ? (
            <div className={styles.outputContent} ref={outputRef as RefObject<HTMLDivElement>}>
              <pre className={styles.outputText}>{output}</pre>
            </div>
          ) : null}
          <ScrollTopButton show={showOutputScrollTop} onClick={onOutputScrollTop} label={mt('scrollTop')} />
        </div>
        <StatsBar stats={outputStats} mt={mt} />
      </ToolSection>
    </div>
  );
}
