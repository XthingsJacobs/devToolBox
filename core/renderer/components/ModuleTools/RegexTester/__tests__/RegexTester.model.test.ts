import { describe, expect, it } from 'vitest';
import {
  buildHighlightedHtml,
  buildRegexFlags,
  compileRegex,
  escapeHtml,
  findRegexMatches,
  generateCode,
  replaceRegexMatches,
} from '../RegexTester.model';

describe('RegexTester model', () => {
  it('builds flags and compiles valid patterns only', () => {
    expect(buildRegexFlags({ global: true, ignoreCase: true, multiline: false })).toBe('gi');
    expect(compileRegex('(', 'g')).toBeNull();
    expect(compileRegex('abc', 'g')).toBeInstanceOf(RegExp);
  });

  it('finds global matches and guards zero-length matches', () => {
    expect(findRegexMatches('a+', 'i', 'A aa b')).toEqual([
      { start: 0, end: 1, text: 'A' },
      { start: 2, end: 4, text: 'aa' },
    ]);
    expect(findRegexMatches('.*?', 'g', 'ab').length).toBeGreaterThan(0);
  });

  it('escapes and highlights matched and unmatched text', () => {
    expect(escapeHtml('<a b="c">')).toBe('&lt;a b=&quot;c&quot;&gt;');
    expect(
      buildHighlightedHtml({
        text: 'a <b> c',
        matches: [{ start: 2, end: 5, text: '<b>' }],
        highlightNoMatch: true,
        classes: { match: 'm', noMatch: 'n' },
      }),
    ).toBe('<span class="n">a </span><span class="m">&lt;b&gt;</span><span class="n"> c</span>');
  });

  it('replaces matches and generates language snippets', () => {
    expect(replaceRegexMatches('a', 'g', 'a b a', 'x')).toBe('x b x');
    expect(generateCode('\\d+', 'gi', 'JavaScript')).toContain('const regex = /\\d+/gi');
    expect(generateCode('a"b', 'i', 'Java')).toContain('Pattern.CASE_INSENSITIVE');
    expect(generateCode("a'b", 'g', 'PHP')).toContain("a\\'b");
  });
});
