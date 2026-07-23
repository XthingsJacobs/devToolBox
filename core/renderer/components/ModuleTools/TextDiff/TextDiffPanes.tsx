import type { ChangeEvent, RefObject, ReactNode } from 'react';
import { VscDiff, VscFolderOpened, VscOutput, VscTrash } from 'react-icons/vsc';
import { ToolSection } from '@@components';
import ResponsiveActions from '../../ResponsiveActions';
import type { DiffLine, DiffSide, DiffStats, LocaleText, WordPart } from './TextDiff.types';
import styles from './TextDiff.module.css';

const ACCEPT_ATTR = '.txt,.js,.ts,.json,.html,.css,.md,.xml,.csv,*';

function renderWordParts(parts: WordPart[]): ReactNode {
  return parts.map((part, index) => {
    if (part.type === 'removed') {
      return (
        <span key={index} className={styles.wordRemoved}>
          {part.value}
        </span>
      );
    }
    if (part.type === 'added') {
      return (
        <span key={index} className={styles.wordAdded}>
          {part.value}
        </span>
      );
    }
    return <span key={index}>{part.value}</span>;
  });
}

function renderContent(content: DiffLine['content']): ReactNode {
  return Array.isArray(content) ? renderWordParts(content) : content;
}

export function DiffPane({ lines, side }: { lines: DiffLine[]; side: DiffSide }) {
  return (
    <table className={styles.diffTable}>
      <tbody>
        {lines.map((line, index) => {
          let className = '';
          if (line.type === 'removed') className = styles.lineRemoved;
          else if (line.type === 'added') className = styles.lineAdded;
          else if (line.type === 'modified')
            className = side === 'left' ? styles.lineRemoved : styles.lineAdded;
          else if (line.type === 'empty') className = styles.lineEmpty;
          return (
            <tr key={index} className={className}>
              <td className={styles.lineNum}>{line.num ?? ''}</td>
              <td className={styles.lineContent}>{renderContent(line.content)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function TextDiffFilePane({
  title,
  icon,
  fileRef,
  paneRef,
  lines,
  side,
  emptyHint,
  onSelectFile,
  onClear,
  onFileSelect,
  mt,
}: {
  title: string;
  icon: ReactNode;
  fileRef: RefObject<HTMLInputElement | null>;
  paneRef: RefObject<HTMLDivElement | null>;
  lines: DiffLine[];
  side: DiffSide;
  emptyHint: string;
  onSelectFile: () => void;
  onClear: () => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.pane}>
      <ToolSection
        fill
        bodyVariant="noPad"
        title={title}
        icon={icon}
        actions={
          <ResponsiveActions
            actions={[
              { label: mt('selectFile'), onClick: onSelectFile, icon: <VscFolderOpened /> },
              { label: mt('clear'), onClick: onClear, icon: <VscTrash /> },
            ]}
          />
        }
      >
        <input
          ref={fileRef as RefObject<HTMLInputElement>}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
        <div className={styles.paneBody} ref={paneRef as RefObject<HTMLDivElement>}>
          {lines.length ? (
            <DiffPane lines={lines} side={side} />
          ) : (
            <div className={styles.emptyHint}>{emptyHint}</div>
          )}
        </div>
      </ToolSection>
    </div>
  );
}

export function TextDiffView({
  leftTitle,
  rightTitle,
  leftFileRef,
  rightFileRef,
  leftPaneRef,
  rightPaneRef,
  leftLines,
  rightLines,
  stats,
  onLeftFileSelect,
  onRightFileSelect,
  onClearLeft,
  onClearRight,
  mt,
}: {
  leftTitle: string;
  rightTitle: string;
  leftFileRef: RefObject<HTMLInputElement | null>;
  rightFileRef: RefObject<HTMLInputElement | null>;
  leftPaneRef: RefObject<HTMLDivElement | null>;
  rightPaneRef: RefObject<HTMLDivElement | null>;
  leftLines: DiffLine[];
  rightLines: DiffLine[];
  stats: DiffStats;
  onLeftFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRightFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearLeft: () => void;
  onClearRight: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.paneArea}>
        <TextDiffFilePane
          title={leftTitle}
          icon={<VscDiff />}
          fileRef={leftFileRef}
          paneRef={leftPaneRef}
          lines={leftLines}
          side="left"
          emptyHint={mt('selectOriginal')}
          onSelectFile={() => leftFileRef.current?.click()}
          onClear={onClearLeft}
          onFileSelect={onLeftFileSelect}
          mt={mt}
        />
        <div className={styles.paneDivider} />
        <TextDiffFilePane
          title={rightTitle}
          icon={<VscOutput />}
          fileRef={rightFileRef}
          paneRef={rightPaneRef}
          lines={rightLines}
          side="right"
          emptyHint={mt('selectModified')}
          onSelectFile={() => rightFileRef.current?.click()}
          onClear={onClearRight}
          onFileSelect={onRightFileSelect}
          mt={mt}
        />
      </div>

      <div className={styles.statusBar}>
        <span>
          {mt('added')}: {stats.added} {mt('lines')}
        </span>
        <span>
          {mt('deleted')}: {stats.removed} {mt('lines')}
        </span>
      </div>
    </div>
  );
}
