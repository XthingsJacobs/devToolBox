import { describe, expect, it } from 'vitest';
import {
  findTextMatches,
  formatJsonText,
  getDisplayData,
  getNextSortOrder,
  getTextStats,
  parseJsonInput,
  sortJsonKeys,
} from '../JsonFormatter.model';

function expectParsed(value: string): unknown {
  const result = parseJsonInput(value);
  expect(result?.ok).toBe(true);
  if (!result || !result.ok) return undefined;
  return result.parsed;
}

describe('JsonFormatter model', () => {
  it('computes text statistics using the existing line-count semantics', () => {
    expect(getTextStats('a b\nc')).toEqual({ length: 5, spaces: 1, newlines: 1 });
    expect(getTextStats('')).toEqual({ length: 0, spaces: 0, newlines: 0 });
  });

  it('parses strict JSON and lenient pasted literals', () => {
    expect(expectParsed('{"b":2,"a":1}')).toEqual({ b: 2, a: 1 });
    expect(expectParsed("{'ok': True, 'value': None}")).toEqual({ ok: true, value: null });
    expect(expectParsed('{"a":1}, {"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
    expect(parseJsonInput('')).toBeNull();
    expect(parseJsonInput('{bad')?.ok).toBe(false);
  });

  it('sorts JSON object keys recursively while preserving array order', () => {
    const source = { b: 2, a: { d: 4, c: 3 }, list: [{ z: 1, y: 2 }] };

    expect(sortJsonKeys(source, true)).toEqual({ a: { c: 3, d: 4 }, b: 2, list: [{ y: 2, z: 1 }] });
    expect(Object.keys(sortJsonKeys(source, false) as Record<string, unknown>)).toEqual(['list', 'b', 'a']);
  });

  it('formats display data according to sort and compression settings', () => {
    const data = { b: 2, a: 1 };

    expect(getDisplayData(data, 'none')).toBe(data);
    expect(formatJsonText(getDisplayData(data, 'asc'), false)).toBe('{\n  "a": 1,\n  "b": 2\n}');
    expect(formatJsonText(getDisplayData(data, 'desc'), true)).toBe('{"b":2,"a":1}');
  });

  it('cycles sort order and finds case-insensitive overlapping matches', () => {
    expect(getNextSortOrder('none')).toBe('asc');
    expect(getNextSortOrder('asc')).toBe('desc');
    expect(getNextSortOrder('desc')).toBe('none');
    expect(findTextMatches('Banana bandana', 'ana')).toEqual([
      { start: 1, end: 4 },
      { start: 3, end: 6 },
      { start: 11, end: 14 },
    ]);
    expect(findTextMatches('ABC abc', 'abc')).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
    ]);
  });
});
