import type { ModuleUsageEntry } from '../../data/moduleUsage';
import type { Category, Module } from '../../types';

export type FlatTool = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  module: Module;
};

export const WIDGET_IDS = ['frequent', 'network', 'appInfo', 'screen', 'device'] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export type WidgetLayout = {
  order: WidgetId[];
  spanById: Record<WidgetId, number>;
  rowSpanById: Record<WidgetId, number>;
};

export const GRID_COLS = 24;
export const GRID_AUTO_ROW_PX = 8;
export const GRID_GAP_PX = 16;

export const DEFAULT_WIDGET_ROW_SPAN: Record<WidgetId, number> = {
  frequent: 18,
  network: 12,
  appInfo: 12,
  screen: 10,
  device: 11,
};

export const DEFAULT_WIDGET_LAYOUT: WidgetLayout = {
  order: [...WIDGET_IDS],
  spanById: {
    frequent: 24,
    network: 12,
    appInfo: 12,
    screen: 12,
    device: 12,
  },
  rowSpanById: { ...DEFAULT_WIDGET_ROW_SPAN },
};

export function isWidgetId(value: unknown): value is WidgetId {
  return WIDGET_IDS.includes(value as WidgetId);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function clampSpan(value: number): number {
  if (!Number.isFinite(value)) return 12;
  const normalized = Math.round(value);
  return Math.max(1, Math.min(GRID_COLS, normalized));
}

export function clampRowSpan(value: number): number {
  if (!Number.isFinite(value)) return 10;
  const normalized = Math.round(value);
  return Math.max(4, Math.min(200, normalized));
}

export function dashboardCategoryColor(categoryId: string): string {
  switch (categoryId) {
    case 'dev-tools':
      return 'var(--cat-dev)';
    case 'text-tools':
      return 'var(--cat-text)';
    case 'network-tools':
      return 'var(--cat-network)';
    case 'security-tools':
      return 'var(--cat-security)';
    case 'other-tools':
      return 'var(--cat-other)';
    default:
      return 'var(--accent-secondary)';
  }
}

export function flattenDashboardTools(categories: Category[]): FlatTool[] {
  return categories.flatMap((category) =>
    category.modules.map((module) => ({
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: dashboardCategoryColor(category.id),
      module,
    })),
  );
}

export function searchDashboardTools(flatTools: FlatTool[], query: string): FlatTool[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  return flatTools
    .filter((tool) => {
      const name = String(tool.module.name ?? '').toLowerCase();
      const description = String(tool.module.description ?? '').toLowerCase();
      return name.includes(normalizedQuery) || description.includes(normalizedQuery);
    })
    .slice(0, 8);
}

export function pickFrequentDashboardTools(
  flatTools: FlatTool[],
  usage: ModuleUsageEntry[],
  scoreUsage: (entry: ModuleUsageEntry) => number,
): FlatTool[] {
  const scored = usage
    .map((entry) => ({ ...entry, score: scoreUsage(entry) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const picked = scored
    .map((entry) =>
      flatTools.find((tool) => tool.categoryId === entry.categoryId && tool.module.id === entry.moduleId),
    )
    .filter(Boolean) as FlatTool[];

  if (picked.length >= 4) return picked;

  const fill = flatTools.filter(
    (tool) => !picked.some((pickedTool) => pickedTool.module.id === tool.module.id),
  );
  return [...picked, ...fill.slice(0, 8 - picked.length)];
}
