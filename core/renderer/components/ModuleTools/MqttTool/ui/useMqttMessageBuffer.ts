import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { MqttMessage } from './MqttWorkspace.types';
import { appendMqttMessages, searchMessageIds } from './MqttWorkspace.model';

function isMsgListAtBottom(el: HTMLDivElement): boolean {
  const threshold = 24;
  return el.scrollTop <= threshold;
}

export function useMqttMessageBuffer() {
  const [messages, setMessages] = useState<MqttMessage[]>([]);
  const [msgSearch, setMsgSearch] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const msgSearchRef = useRef<HTMLInputElement>(null);
  const msgListRef = useRef<HTMLDivElement>(null);
  const msgStickToBottomRef = useRef(true);
  const pendingMessagesRef = useRef<MqttMessage[]>([]);
  const flushRafRef = useRef<number | null>(null);
  const scrollAfterFlushRef = useRef(false);

  const flushPendingMessages = useCallback(() => {
    flushRafRef.current = null;
    const pending = pendingMessagesRef.current;
    if (pending.length === 0) return;
    pendingMessagesRef.current = [];
    setMessages((prev) => appendMqttMessages(prev, pending));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushRafRef.current !== null) return;
    flushRafRef.current = window.requestAnimationFrame(flushPendingMessages);
  }, [flushPendingMessages]);

  useEffect(() => {
    const el = msgListRef.current;
    if (!el) return;
    const update = () => {
      const bottom = isMsgListAtBottom(el);
      msgStickToBottomRef.current = bottom;
      if (!bottom) scrollAfterFlushRef.current = false;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      el.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (flushRafRef.current !== null) window.cancelAnimationFrame(flushRafRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!scrollAfterFlushRef.current) return;
    if (!msgStickToBottomRef.current) {
      scrollAfterFlushRef.current = false;
      return;
    }
    scrollAfterFlushRef.current = false;
    const el = msgListRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [messages.length]);

  const appendMessage = useCallback(
    (message: MqttMessage) => {
      const el = msgListRef.current;
      const shouldStick = !el || isMsgListAtBottom(el);
      msgStickToBottomRef.current = shouldStick;
      if (shouldStick) scrollAfterFlushRef.current = true;
      pendingMessagesRef.current.push(message);
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const clearMessages = useCallback(() => {
    msgStickToBottomRef.current = true;
    scrollAfterFlushRef.current = false;
    pendingMessagesRef.current = [];
    if (flushRafRef.current !== null) {
      window.cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }
    setMessages([]);
  }, []);

  const searchMatches = useMemo(() => searchMessageIds(messages, msgSearch), [messages, msgSearch]);

  const scrollToMatch = useCallback(
    (idx: number) => {
      if (!searchMatches.length || !msgListRef.current) return;
      const id = searchMatches[idx];
      const el = msgListRef.current.querySelector(`[data-msgid="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [searchMatches],
  );

  const handleSearchNext = useCallback(() => {
    if (!searchMatches.length) return;
    const next = (searchMatchIdx + 1) % searchMatches.length;
    setSearchMatchIdx(next);
    scrollToMatch(next);
  }, [searchMatchIdx, searchMatches.length, scrollToMatch]);

  const handleSearchPrev = useCallback(() => {
    if (!searchMatches.length) return;
    const prev = (searchMatchIdx - 1 + searchMatches.length) % searchMatches.length;
    setSearchMatchIdx(prev);
    scrollToMatch(prev);
  }, [searchMatchIdx, searchMatches.length, scrollToMatch]);

  useEffect(() => {
    setSearchMatchIdx(0);
  }, [msgSearch]);

  const openMessageSearch = useCallback(() => {
    setShowMsgSearch(true);
    setTimeout(() => msgSearchRef.current?.focus(), 0);
  }, []);

  const closeMessageSearch = useCallback(() => {
    setShowMsgSearch(false);
    setMsgSearch('');
  }, []);

  const handleWorkspaceKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        openMessageSearch();
      }
      if (e.key === 'Escape' && showMsgSearch) {
        closeMessageSearch();
      }
    },
    [closeMessageSearch, openMessageSearch, showMsgSearch],
  );

  return {
    messages,
    orderedMessages: useMemo(() => [...messages].reverse(), [messages]),
    msgListRef,
    msgSearchRef,
    msgSearch,
    setMsgSearch,
    showMsgSearch,
    searchMatches,
    searchMatchIdx,
    appendMessage,
    clearMessages,
    handleSearchNext,
    handleSearchPrev,
    openMessageSearch,
    closeMessageSearch,
    handleWorkspaceKeyDown,
  };
}
