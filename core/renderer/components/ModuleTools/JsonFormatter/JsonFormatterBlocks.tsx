import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { VscChevronDown, VscChevronUp, VscChromeClose } from 'react-icons/vsc';
import type { LocaleText, TextMatch, TextStats } from './JsonFormatter.types';
import styles from './JsonFormatter.module.css';

export function StatsBar({ stats, mt }: { stats: TextStats; mt: LocaleText }) {
  return (
    <div className={styles.statusBar}>
      <span>
        {mt('length')}: {stats.length}
      </span>
      <span>
        {mt('spaces')}: {stats.spaces}
      </span>
      <span>
        {mt('newlines')}: {stats.newlines}
      </span>
    </div>
  );
}

export function SearchBar({
  inputRef,
  value,
  onChange,
  onKeyDown,
  matchCount,
  currentIndex,
  onPrev,
  onNext,
  onClose,
  mt,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  matchCount: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.searchBar}>
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        className={styles.searchInput}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={mt('searchPlaceholder')}
        spellCheck={false}
        autoFocus
      />
      <span className={styles.searchInfo}>
        {matchCount > 0 ? `${currentIndex + 1}/${matchCount}` : '0/0'}
      </span>
      <button className={styles.searchBtn} onClick={onPrev} aria-label={mt('prevMatch')}>
        <VscChevronUp />
      </button>
      <button className={styles.searchBtn} onClick={onNext} aria-label={mt('nextMatch')}>
        <VscChevronDown />
      </button>
      <button className={styles.searchBtn} onClick={onClose} aria-label={mt('closeSearch')}>
        <VscChromeClose />
      </button>
    </div>
  );
}

export function buildHighlightContent({
  text,
  matches,
  currentIndex,
}: {
  text: string;
  matches: TextMatch[];
  currentIndex: number;
}): ReactNode[] | null {
  if (matches.length === 0) return null;
  const parts: ReactNode[] = [];
  let lastEnd = 0;
  matches.forEach((match, index) => {
    if (match.start > lastEnd) parts.push(text.slice(lastEnd, match.start));
    parts.push(
      <mark
        key={index}
        className={index === currentIndex ? styles.highlightMarkActive : styles.highlightMark}
      >
        {text.slice(match.start, match.end)}
      </mark>,
    );
    lastEnd = match.end;
  });
  if (lastEnd < text.length) parts.push(text.slice(lastEnd));
  return parts;
}
