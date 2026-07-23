import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { findTextMatches } from './JsonFormatter.model';
import { buildHighlightContent } from './JsonFormatterBlocks';

interface UseJsonTextSearchOptions {
  text: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useJsonTextSearch({ text, textareaRef, onOpen, onClose }: UseJsonTextSearchOptions) {
  const [visible, setVisible] = useState(false);
  const [term, setTerm] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => findTextMatches(text, term), [text, term]);
  const highlightContent = useMemo(() => {
    if (!visible || !term) return null;
    return buildHighlightContent({ text, matches, currentIndex: currentMatchIndex });
  }, [currentMatchIndex, matches, term, text, visible]);

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [matches.length]);

  const openSearch = useCallback(() => {
    onOpen?.();
    setVisible(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [onOpen]);

  const closeSearch = useCallback(() => {
    setVisible(false);
    setTerm('');
    setCurrentMatchIndex(0);
    onClose?.();
  }, [onClose]);

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        openSearch();
      }
    },
    [openSearch],
  );

  const handleContainerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        openSearch();
      }
    },
    [openSearch],
  );

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') closeSearch();
      else if (event.key === 'Enter') {
        event.preventDefault();
        if (matches.length > 0) setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
      }
    },
    [closeSearch, matches.length],
  );

  const goToPrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  useEffect(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (!textarea || !overlay) return;
    const syncScroll = () => {
      overlay.scrollTop = textarea.scrollTop;
      overlay.scrollLeft = textarea.scrollLeft;
    };
    textarea.addEventListener('scroll', syncScroll, { passive: true });
    return () => textarea.removeEventListener('scroll', syncScroll);
  }, [textareaRef, visible]);

  useEffect(() => {
    if (!visible || matches.length === 0) return;
    const textarea = textareaRef.current;
    const match = matches[currentMatchIndex];
    if (!textarea || !match) return;
    const linesBefore = text.slice(0, match.start).split('\n').length - 1;
    const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    textarea.scrollTop = Math.max(0, linesBefore * lineHeight - textarea.clientHeight / 2);
  }, [currentMatchIndex, matches, text, textareaRef, visible]);

  return {
    searchInputRef,
    overlayRef,
    visible,
    term,
    setTerm,
    matches,
    currentMatchIndex,
    highlightContent,
    openSearch,
    closeSearch,
    handleTextareaKeyDown,
    handleContainerKeyDown,
    handleSearchKeyDown,
    goToPrevMatch,
    goToNextMatch,
  };
}
