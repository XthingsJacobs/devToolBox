import type { RefObject } from 'react';
import { VscArrowDown, VscCode, VscLock, VscPlay, VscRocket, VscTrash, VscWand } from 'react-icons/vsc';
import { ToolSection } from '@@components';
import ResponsiveActions from '../../ResponsiveActions';
import { ScrollTopButton, StatsBar } from './JsFormatterBlocks';
import type { JsTextStats, LocaleText } from './JsFormatter.types';
import styles from './JsFormatter.module.css';

export function JsFormatterInputPane({
  widthPercent,
  editorRef,
  inputStats,
  showInputScrollTop,
  onBeautify,
  onMinify,
  onObfuscate,
  onEvalPack,
  onHighCompress,
  onClear,
  onInputScrollTop,
  mt,
}: {
  widthPercent: number;
  editorRef: RefObject<HTMLDivElement | null>;
  inputStats: JsTextStats;
  showInputScrollTop: boolean;
  onBeautify: () => void;
  onMinify: () => void;
  onObfuscate: () => void;
  onEvalPack: () => void;
  onHighCompress: () => void;
  onClear: () => void;
  onInputScrollTop: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.inputPane} style={{ width: `${widthPercent}%` }}>
      <ToolSection
        fill
        bodyVariant="noPad"
        title={mt('jsInput')}
        icon={<VscCode />}
        actions={
          <ResponsiveActions
            actions={[
              { label: mt('beautify'), onClick: onBeautify, icon: <VscWand /> },
              { label: mt('minify'), onClick: onMinify, icon: <VscArrowDown /> },
              { label: mt('obfuscate'), onClick: onObfuscate, icon: <VscLock /> },
              { label: mt('evalPack'), onClick: onEvalPack, icon: <VscPlay /> },
              { label: mt('highCompress'), onClick: onHighCompress, icon: <VscRocket /> },
              { label: mt('clear'), onClick: onClear, icon: <VscTrash /> },
            ]}
          />
        }
      >
        <div className={styles.editorWrap}>
          <div className={styles.editorBody} ref={editorRef as RefObject<HTMLDivElement>} />
          <ScrollTopButton show={showInputScrollTop} onClick={onInputScrollTop} label={mt('scrollTop')} />
        </div>
        <StatsBar stats={inputStats} mt={mt} />
      </ToolSection>
    </div>
  );
}
