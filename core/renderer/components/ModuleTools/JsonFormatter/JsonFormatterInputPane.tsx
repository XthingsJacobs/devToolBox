import type { ChangeEvent, KeyboardEvent, ReactNode, RefObject } from 'react';
import { VscChevronUp, VscEdit, VscFolderOpened, VscTrash } from 'react-icons/vsc';
import { ToolSection } from '@@components';
import ResponsiveActions from '../../ResponsiveActions';
import { SearchBar, StatsBar } from './JsonFormatterBlocks';
import type { LocaleText, TextMatch, TextStats } from './JsonFormatter.types';
import styles from './JsonFormatter.module.css';

export function JsonFormatterInputPane({
  widthPercent,
  input,
  inputStats,
  textareaRef,
  fileInputRef,
  searchInputRef,
  overlayRef,
  searchVisible,
  searchTerm,
  matches,
  currentMatchIndex,
  highlightContent,
  inputScroll,
  onInputChange,
  onFileSelect,
  onSearchTermChange,
  onTextareaKeyDown,
  onSearchKeyDown,
  onPrevMatch,
  onNextMatch,
  onCloseSearch,
  mt,
}: {
  widthPercent: number;
  input: string;
  inputStats: TextStats;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  searchVisible: boolean;
  searchTerm: string;
  matches: TextMatch[];
  currentMatchIndex: number;
  highlightContent: ReactNode;
  inputScroll: { show: boolean; scrollToTop: () => void };
  onInputChange: (value: string) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onSearchTermChange: (value: string) => void;
  onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onCloseSearch: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.inputPane} style={{ width: `${widthPercent}%` }}>
      <ToolSection
        fill
        bodyVariant="noPad"
        title={mt('inputJson')}
        icon={<VscEdit />}
        actions={
          <ResponsiveActions
            actions={[
              {
                label: mt('selectFile'),
                onClick: () => fileInputRef.current?.click(),
                icon: <VscFolderOpened />,
              },
              { label: mt('clear'), onClick: () => onInputChange(''), icon: <VscTrash /> },
            ]}
          />
        }
      >
        <input
          ref={fileInputRef as RefObject<HTMLInputElement>}
          type="file"
          accept=".json,.txt"
          onChange={onFileSelect}
          style={{ display: 'none' }}
        />
        <div className={styles.textareaWrap}>
          {searchVisible && (
            <SearchBar
              inputRef={searchInputRef}
              value={searchTerm}
              onChange={onSearchTermChange}
              onKeyDown={onSearchKeyDown}
              matchCount={matches.length}
              currentIndex={currentMatchIndex}
              onPrev={onPrevMatch}
              onNext={onNextMatch}
              onClose={onCloseSearch}
              mt={mt}
            />
          )}
          {searchVisible && (
            <div
              ref={overlayRef as RefObject<HTMLDivElement>}
              className={`${styles.highlightOverlay} highlightOverlay`}
            >
              {highlightContent}
            </div>
          )}
          <textarea
            ref={textareaRef as RefObject<HTMLTextAreaElement>}
            className={`${styles.textarea}${searchVisible ? ` ${styles.textareaTransparent}` : ''}`}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onTextareaKeyDown}
            placeholder={mt('placeholder')}
            spellCheck={false}
          />
          <button
            className={`${styles.scrollTopBtn} ${inputScroll.show ? styles.scrollTopVisible : ''}`}
            onClick={inputScroll.scrollToTop}
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
