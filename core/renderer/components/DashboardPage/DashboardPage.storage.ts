import {
  DEFAULT_WIDGET_LAYOUT,
  WIDGET_IDS,
  clampRowSpan,
  clampSpan,
  isRecord,
  isWidgetId,
  type WidgetLayout,
} from './DashboardPage.model';

const WIDGET_STORAGE_KEY_V2 = 'devtoolbox.dashboard.widgets.v2';
const WIDGET_STORAGE_KEY = 'devtoolbox.dashboard.widgets.v3';

function cloneDefaultLayout(): WidgetLayout {
  return {
    order: [...DEFAULT_WIDGET_LAYOUT.order],
    spanById: { ...DEFAULT_WIDGET_LAYOUT.spanById },
    rowSpanById: { ...DEFAULT_WIDGET_LAYOUT.rowSpanById },
  };
}

export function loadWidgetLayout(): WidgetLayout {
  const fallback = cloneDefaultLayout();
  const raw = localStorage.getItem(WIDGET_STORAGE_KEY) ?? localStorage.getItem(WIDGET_STORAGE_KEY_V2);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return fallback;

    const orderRaw = parsed.order;
    const spanRaw = parsed.spanById;
    const rowSpanRaw = parsed.rowSpanById;
    if (!Array.isArray(orderRaw) || !isRecord(spanRaw)) return fallback;

    const order = orderRaw.filter(isWidgetId);
    const uniqueOrder = Array.from(new Set(order));
    const fullOrder = [...uniqueOrder, ...WIDGET_IDS.filter((id) => !uniqueOrder.includes(id))];
    const spanById = { ...fallback.spanById };
    const rowSpanById = { ...fallback.rowSpanById };

    for (const id of WIDGET_IDS) {
      const span = spanRaw[id];
      if (typeof span === 'number') spanById[id] = clampSpan(span);

      const rowSpan = isRecord(rowSpanRaw) ? rowSpanRaw[id] : undefined;
      if (typeof rowSpan === 'number') rowSpanById[id] = clampRowSpan(rowSpan);
    }

    return { order: fullOrder, spanById, rowSpanById };
  } catch {
    return fallback;
  }
}

export function saveWidgetLayout(layout: WidgetLayout): void {
  localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(layout));
}
