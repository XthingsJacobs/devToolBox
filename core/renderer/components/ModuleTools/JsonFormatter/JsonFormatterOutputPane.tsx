import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import {
  VscArrowDown,
  VscChevronUp,
  VscCollapseAll,
  VscCopy,
  VscExpandAll,
  VscJson,
  VscOutput,
  VscSave,
  VscSortPrecedence,
} from 'react-icons/vsc';
import { JsonTreeView, ToolSection } from '@@components';
import ResponsiveActions from '../../ResponsiveActions';
import { SearchBar, StatsBar } from './JsonFormatterBlocks';
import type { LocaleText, SortOrder, TextMatch, TextStats } from './JsonFormatter.types';
import styles from './JsonFormatter.module.css';

export function JsonFormatterOutputPane({
  widthPercent,
  displayData,
  error,
  formattedText,
  outputStats,
  isTextOutput,
  outputFocusRef,
  outputTreeRef,
  outputTextareaRef,
  outputSearchInputRef,
  outputOverlayRef,
  outputSearchVisible,
  outputSearchTerm,
  outputMatches,
  outputCurrentMatchIndex,
  outputHighlightContent,
  activeOutputScroll,
  copied,
  sortOrder,
  expandAll,
  treeKey,
  onCompress,
  onFormat,
  onCopy,
  onDownload,
  onSort,
  onToggleExpand,
  onOutputSearchTermChange,
  onOutputContainerKeyDown,
  onOutputTextareaKeyDown,
  onOutputSearchKeyDown,
  onPrevOutputMatch,
  onNextOutputMatch,
  onCloseOutputSearch,
  mt,
}: {
  widthPercent: number;
  displayData: unknown;
  error: string;
  formattedText: string;
  outputStats: TextStats;
  isTextOutput: boolean;
  outputFocusRef: RefObject<HTMLDivElement | null>;
  outputTreeRef: RefObject<HTMLDivElement | null>;
  outputTextareaRef: RefObject<HTMLTextAreaElement | null>;
  outputSearchInputRef: RefObject<HTMLInputElement | null>;
  outputOverlayRef: RefObject<HTMLDivElement | null>;
  outputSearchVisible: boolean;
  outputSearchTerm: string;
  outputMatches: TextMatch[];
  outputCurrentMatchIndex: number;
  outputHighlightContent: ReactNode;
  activeOutputScroll: { show: boolean; scrollToTop: () => void };
  copied: boolean;
  sortOrder: SortOrder;
  expandAll: boolean;
  treeKey: number;
  onCompress: () => void;
  onFormat: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onSort: () => void;
  onToggleExpand: () => void;
  onOutputSearchTermChange: (value: string) => void;
  onOutputContainerKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onOutputTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onOutputSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onPrevOutputMatch: () => void;
  onNextOutputMatch: () => void;
  onCloseOutputSearch: () => void;
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
            actions={[
              { label: mt('compress'), onClick: onCompress, icon: <VscArrowDown /> },
              { label: mt('format'), onClick: onFormat, icon: <VscJson /> },
              { label: copied ? mt('copied') : mt('copy'), onClick: onCopy, icon: <VscCopy /> },
              { label: mt('download'), onClick: onDownload, icon: <VscSave /> },
              {
                label:
                  sortOrder === 'none' ? mt('sort') : sortOrder === 'asc' ? mt('sortAsc') : mt('sortDesc'),
                onClick: onSort,
                icon: <VscSortPrecedence />,
              },
              {
                label: expandAll ? mt('collapse') : mt('expand'),
                onClick: onToggleExpand,
                icon: expandAll ? <VscCollapseAll /> : <VscExpandAll />,
              },
            ]}
          />
        }
      >
        <div className={styles.outputWrap}>
          <div
            className={styles.outputBody}
            ref={outputFocusRef as RefObject<HTMLDivElement>}
            tabIndex={0}
            onKeyDown={onOutputContainerKeyDown}
            onMouseDown={() => outputFocusRef.current?.focus?.()}
          >
            {isTextOutput ? (
              <div className={styles.textareaWrap}>
                {outputSearchVisible && (
                  <SearchBar
                    inputRef={outputSearchInputRef}
                    value={outputSearchTerm}
                    onChange={onOutputSearchTermChange}
                    onKeyDown={onOutputSearchKeyDown}
                    matchCount={outputMatches.length}
                    currentIndex={outputCurrentMatchIndex}
                    onPrev={onPrevOutputMatch}
                    onNext={onNextOutputMatch}
                    onClose={onCloseOutputSearch}
                    mt={mt}
                  />
                )}
                {outputSearchVisible && (
                  <div
                    ref={outputOverlayRef as RefObject<HTMLDivElement>}
                    className={`${styles.highlightOverlay} highlightOverlay`}
                  >
                    {outputHighlightContent}
                  </div>
                )}
                <textarea
                  ref={outputTextareaRef as RefObject<HTMLTextAreaElement>}
                  className={`${styles.textarea}${outputSearchVisible ? ` ${styles.textareaTransparent}` : ''}`}
                  value={formattedText}
                  readOnly
                  spellCheck={false}
                  onKeyDown={onOutputTextareaKeyDown}
                />
              </div>
            ) : (
              <div className={styles.treeWrap} ref={outputTreeRef as RefObject<HTMLDivElement>}>
                {error ? (
                  <pre className={styles.error}>{error}</pre>
                ) : displayData !== undefined ? (
                  <JsonTreeView
                    key={treeKey}
                    data={displayData}
                    defaultCollapsedDepth={expandAll ? 999 : 0}
                  />
                ) : null}
              </div>
            )}
          </div>
          <button
            className={`${styles.scrollTopBtn} ${activeOutputScroll.show ? styles.scrollTopVisible : ''}`}
            onClick={activeOutputScroll.scrollToTop}
            aria-label={mt('scrollTop')}
          >
            <VscChevronUp />
          </button>
        </div>
        <StatsBar stats={outputStats} mt={mt} />
      </ToolSection>
    </div>
  );
}
