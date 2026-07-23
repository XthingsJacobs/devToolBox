import { useCallback, useRef, useState, type MouseEvent } from 'react';

export function useMqttResizablePanes() {
  const [pubHeight, setPubHeight] = useState(180);
  const [leftWidth, setLeftWidth] = useState(280);
  const draggingRef = useRef(false);

  const handlePublishResizeStart = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      draggingRef.current = true;
      const startY = event.clientY;
      const startHeight = pubHeight;
      const onMove = (moveEvent: globalThis.MouseEvent) => {
        if (!draggingRef.current) return;
        const delta = startY - moveEvent.clientY;
        setPubHeight(Math.max(100, Math.min(500, startHeight + delta)));
      };
      const onUp = () => {
        draggingRef.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [pubHeight],
  );

  const handleSidebarResizeStart = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = leftWidth;
      const onMove = (moveEvent: globalThis.MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        setLeftWidth(Math.max(160, Math.min(500, startWidth + delta)));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [leftWidth],
  );

  return {
    pubHeight,
    leftWidth,
    handlePublishResizeStart,
    handleSidebarResizeStart,
  };
}
