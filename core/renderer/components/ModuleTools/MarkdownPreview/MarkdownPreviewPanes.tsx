import type { ChangeEvent, RefObject } from 'react';
import {
  VscChevronUp,
  VscFolderOpened,
  VscMarkdown,
  VscPreview,
  VscSave,
  VscSaveAs,
  VscTrash,
} from 'react-icons/vsc';
import { ToolSection } from '@@components';
import ResponsiveActions from '../../ResponsiveActions';
import type { LocaleText, MarkdownTextStats } from './MarkdownPreview.types';
import styles from './MarkdownPreview.module.css';

function StatsBar({ stats, mt }: { stats: MarkdownTextStats; mt: LocaleText }) {
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

export function MarkdownEditorPane({
  widthPercent,
  fileInputRef,
  editorRef,
  showScrollTop,
  inputStats,
  onOpen,
  onSave,
  onSaveAs,
  onClear,
  onFileSelect,
  onScrollTop,
  mt,
}: {
  widthPercent: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  editorRef: RefObject<HTMLDivElement | null>;
  showScrollTop: boolean;
  inputStats: MarkdownTextStats;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onClear: () => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onScrollTop: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.editorPane} style={{ width: `${widthPercent}%` }}>
      <ToolSection
        fill
        bodyVariant="noPad"
        title={mt('mdEdit')}
        icon={<VscMarkdown />}
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
              { label: mt('clear'), onClick: onClear, icon: <VscTrash /> },
            ]}
          />
        }
      >
        <input
          ref={fileInputRef as RefObject<HTMLInputElement>}
          type="file"
          accept=".md,.markdown,.txt"
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

export function MarkdownPreviewPane({
  widthPercent,
  previewHtml,
  isDragging,
  mt,
}: {
  widthPercent: number;
  previewHtml: string;
  isDragging: boolean;
  mt: LocaleText;
}) {
  return (
    <div className={styles.previewPane} style={{ width: `${widthPercent}%` }}>
      <ToolSection fill bodyVariant="noPad" title={mt('livePreview')} icon={<VscPreview />}>
        <div className={styles.previewBody}>
          {isDragging && <div className={styles.dragOverlay} />}
          <iframe title="Markdown Preview" srcDoc={previewHtml} sandbox="" />
        </div>
      </ToolSection>
    </div>
  );
}
