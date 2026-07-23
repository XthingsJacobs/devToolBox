import type { ChangeEvent, RefObject } from 'react';
import {
  VscArrowDown,
  VscChevronUp,
  VscCloudDownload,
  VscCode,
  VscCopy,
  VscFolderOpened,
  VscOpenPreview,
  VscSave,
  VscSaveAs,
  VscTrash,
  VscWand,
} from 'react-icons/vsc';
import { ToolSection } from '@@components';
import ResponsiveActions from '../../ResponsiveActions';
import type { HtmlTextStats, LocaleText } from './HtmlEditor.types';
import styles from './HtmlEditor.module.css';

function StatsBar({ stats, mt }: { stats: HtmlTextStats; mt: LocaleText }) {
  return (
    <div className={styles.statusBar}>
      <span>
        {mt('chars')}: {stats.length}
      </span>
      <span>
        {mt('lines')}: {stats.lines}
      </span>
    </div>
  );
}

export function HtmlEditorPane({
  widthPercent,
  minPaneWidth,
  copied,
  fileInputRef,
  editorRef,
  showScrollTop,
  inputStats,
  onOpen,
  onSave,
  onSaveAs,
  onCompress,
  onBeautify,
  onCopy,
  onDownload,
  onClear,
  onFileSelect,
  onScrollTop,
  mt,
}: {
  widthPercent: number;
  minPaneWidth: number;
  copied: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  editorRef: RefObject<HTMLDivElement | null>;
  showScrollTop: boolean;
  inputStats: HtmlTextStats;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onCompress: () => void;
  onBeautify: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onClear: () => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onScrollTop: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.editorPane} style={{ width: `${widthPercent}%`, minWidth: minPaneWidth }}>
      <ToolSection
        fill
        bodyVariant="noPad"
        title={mt('htmlEdit')}
        icon={<VscCode />}
        actions={
          <ResponsiveActions
            actions={[
              { label: mt('open'), onClick: onOpen, icon: <VscFolderOpened /> },
              {
                label: mt('save'),
                onClick: onSave,
                icon: <VscSave />,
                subActions: [{ label: mt('saveAs'), onClick: onSaveAs, icon: <VscSaveAs /> }],
              },
              { label: mt('compress'), onClick: onCompress, icon: <VscArrowDown /> },
              { label: mt('beautify'), onClick: onBeautify, icon: <VscWand /> },
              { label: copied ? mt('copied') : mt('copy'), onClick: onCopy, icon: <VscCopy /> },
              { label: mt('download'), onClick: onDownload, icon: <VscCloudDownload /> },
              { label: mt('clear'), onClick: onClear, icon: <VscTrash /> },
            ]}
          />
        }
      >
        <input
          ref={fileInputRef as RefObject<HTMLInputElement>}
          type="file"
          accept=".html,.htm,.txt"
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
        <div className={styles.editorBodyWrap}>
          <div className={styles.editorBody} ref={editorRef as RefObject<HTMLDivElement>} />
          <button
            className={`${styles.scrollTopBtn} ${showScrollTop ? styles.scrollTopVisible : ''}`}
            onClick={onScrollTop}
            aria-label={mt('scrollTop')}
          >
            <VscChevronUp />
          </button>
        </div>
        <StatsBar stats={inputStats} mt={mt} />
      </ToolSection>
    </div>
  );
}

export function HtmlPreviewPane({
  widthPercent,
  minPaneWidth,
  previewHtml,
  isDragging,
  mt,
}: {
  widthPercent: number;
  minPaneWidth: number;
  previewHtml: string;
  isDragging: boolean;
  mt: LocaleText;
}) {
  return (
    <div className={styles.previewPane} style={{ width: `${widthPercent}%`, minWidth: minPaneWidth }}>
      <ToolSection fill bodyVariant="noPad" title={mt('livePreview')} icon={<VscOpenPreview />}>
        <div className={styles.previewBody}>
          {isDragging && <div className={styles.dragOverlay} />}
          <iframe title={mt('htmlPreview')} srcDoc={previewHtml} sandbox="allow-scripts" />
        </div>
      </ToolSection>
    </div>
  );
}
