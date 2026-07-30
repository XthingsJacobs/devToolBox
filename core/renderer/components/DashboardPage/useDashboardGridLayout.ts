import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { useContainerWidth, verticalCompactor } from 'react-grid-layout';
import {
  DEFAULT_WIDGET_ROW_SPAN,
  GRID_COLS,
  WIDGET_IDS,
  clampRowSpan,
  clampSpan,
  isWidgetId,
  type WidgetLayout,
} from './DashboardPage.model';
import { loadWidgetLayout, saveWidgetLayout } from './DashboardPage.storage';

export type DashboardGridLayoutController = {
  width: number;
  mounted: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  layout: LayoutItem[];
  handleDragStart: () => void;
  handleResizeStart: () => void;
  handleLayoutChange: (nextLayout: Layout) => void;
  handleDragStop: (nextLayout: Layout) => void;
  handleResizeStop: (nextLayout: Layout) => void;
};

function toMutableLayout(layout: Layout): LayoutItem[] {
  return layout.map((item) => ({ ...item }));
}

function buildGridLayout(source: WidgetLayout): LayoutItem[] {
  const next: LayoutItem[] = [];
  let x = 0;
  let y = 0;
  let rowMaxH = 0;

  for (const id of source.order) {
    const w = clampSpan(source.spanById[id] ?? 12);
    const h = clampRowSpan(source.rowSpanById[id] ?? DEFAULT_WIDGET_ROW_SPAN[id] ?? 10);

    if (x + w > GRID_COLS) {
      y += rowMaxH || 1;
      x = 0;
      rowMaxH = 0;
    }

    next.push({
      i: id,
      x,
      y,
      w,
      h,
      minW: 6,
      maxW: GRID_COLS,
      minH: 6,
      maxH: 200,
    });

    x += w;
    rowMaxH = Math.max(rowMaxH, h);
  }

  return toMutableLayout(verticalCompactor.compact(next, GRID_COLS));
}

export function useDashboardGridLayout(): DashboardGridLayoutController {
  const [layout, setLayout] = useState<WidgetLayout>(() => loadWidgetLayout());
  const [gridLayout, setGridLayout] = useState<LayoutItem[]>([]);
  const [isGridInteracting, setIsGridInteracting] = useState(false);
  const layoutRef = useRef(layout);
  const { width, containerRef, mounted } = useContainerWidth();

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    saveWidgetLayout(layout);
  }, [layout]);

  useEffect(() => {
    if (isGridInteracting) return;
    setGridLayout(buildGridLayout(layout));
  }, [isGridInteracting, layout]);

  const commitLayout = useCallback((nextLayout: Layout) => {
    const compacted = verticalCompactor.compact(nextLayout, GRID_COLS);
    const order = [...compacted]
      .sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      })
      .map((item) => item.i)
      .filter(isWidgetId);
    const fullOrder = [...order, ...WIDGET_IDS.filter((id) => !order.includes(id))];
    const spanById = { ...layoutRef.current.spanById };
    const rowSpanById = { ...layoutRef.current.rowSpanById };

    for (const item of compacted) {
      if (!isWidgetId(item.i)) continue;
      spanById[item.i] = clampSpan(item.w);
      rowSpanById[item.i] = clampRowSpan(item.h);
    }

    setLayout({ order: fullOrder, spanById, rowSpanById });
  }, []);

  const handleInteractionStart = useCallback(() => setIsGridInteracting(true), []);
  const handleLayoutChange = useCallback(
    (nextLayout: Layout) => setGridLayout(toMutableLayout(nextLayout)),
    [],
  );
  const handleDragStop = useCallback(
    (nextLayout: Layout) => {
      setIsGridInteracting(false);
      commitLayout(nextLayout);
    },
    [commitLayout],
  );
  const handleResizeStop = useCallback(
    (nextLayout: Layout) => {
      setIsGridInteracting(false);
      commitLayout(nextLayout);
    },
    [commitLayout],
  );

  return {
    width,
    mounted,
    containerRef,
    layout: gridLayout,
    handleDragStart: handleInteractionStart,
    handleResizeStart: handleInteractionStart,
    handleLayoutChange,
    handleDragStop,
    handleResizeStop,
  };
}
