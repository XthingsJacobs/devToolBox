import { useCallback, useEffect, useRef, useState } from 'react';

export function useJsSplitPane(initialPercent = 50) {
  const [splitPercent, setSplitPercent] = useState(initialPercent);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const handleMouseDown = useCallback(() => {
    dragCleanupRef.current?.();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (event: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = ((event.clientX - rect.left) / rect.width) * 100;
      setSplitPercent(Math.min(80, Math.max(20, percent)));
    };

    const cleanup = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragCleanupRef.current = null;
    };
    const onMouseUp = () => cleanup();

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    dragCleanupRef.current = cleanup;
  }, []);

  useEffect(
    () => () => {
      dragCleanupRef.current?.();
    },
    [],
  );

  return { containerRef, splitPercent, handleMouseDown };
}
