import type { JsonInputParseResult, SortOrder, TextMatch, TextStats } from './JsonFormatter.types';

export function getTextStats(text: string): TextStats {
  const length = text.length;
  const spaces = (text.match(/ /g) || []).length;
  const newlines = (text.match(/\n/g) || []).length;
  return { length, spaces, newlines };
}

export function sortJsonKeys(value: unknown, asc: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => sortJsonKeys(item, asc));
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort();
    if (!asc) keys.reverse();
    return keys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortJsonKeys(source[key], asc);
      return acc;
    }, {});
  }
  return value;
}

export function parseJsonInput(value: string): JsonInputParseResult | null {
  if (!value.trim()) return null;

  try {
    return { ok: true, parsed: JSON.parse(value) as unknown };
  } catch {
    // Fall back to the legacy lenient path for Python-style literals and pasted object lists.
  }

  try {
    let fixed = value.trim();
    if (fixed.startsWith('{') && !fixed.startsWith('[') && /\},\s*\{/.test(fixed)) {
      fixed = `[${fixed}]`;
    }
    fixed = fixed
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null');
    fixed = fixed.replace(/'/g, '"');
    return { ok: true, parsed: JSON.parse(fixed) as unknown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON' };
  }
}

export function getDisplayData(parsed: unknown, sortOrder: SortOrder): unknown {
  if (sortOrder === 'none') return parsed;
  return sortJsonKeys(parsed, sortOrder === 'asc');
}

export function formatJsonText(data: unknown, compressed: boolean): string {
  return compressed ? JSON.stringify(data) : JSON.stringify(data, null, 2);
}

export function getNextSortOrder(sortOrder: SortOrder): SortOrder {
  if (sortOrder === 'none') return 'asc';
  if (sortOrder === 'asc') return 'desc';
  return 'none';
}

export function findTextMatches(text: string, searchTerm: string): TextMatch[] {
  if (!searchTerm || !text) return [];
  const result: TextMatch[] = [];
  const term = searchTerm.toLowerCase();
  const haystack = text.toLowerCase();
  let index = haystack.indexOf(term);
  while (index !== -1) {
    result.push({ start: index, end: index + searchTerm.length });
    index = haystack.indexOf(term, index + 1);
  }
  return result;
}
