import { describe, expect, it } from 'vitest';
import { buildDiffPanes, buildWordParts, calculateDiffStats, toDisplayLines } from '../TextDiff.model';

describe('TextDiff model', () => {
  it('builds display lines for single-sided content', () => {
    expect(toDisplayLines('a\nb')).toEqual([
      { num: 1, content: 'a', type: 'equal' },
      { num: 2, content: 'b', type: 'equal' },
    ]);
  });

  it('builds word-level parts for modified lines', () => {
    expect(buildWordParts('hello old world', 'hello new world', 'left')).toEqual([
      { value: 'hello ', type: 'equal' },
      { value: 'old', type: 'removed' },
      { value: ' world', type: 'equal' },
    ]);
    expect(buildWordParts('hello old world', 'hello new world', 'right')).toEqual([
      { value: 'hello ', type: 'equal' },
      { value: 'new', type: 'added' },
      { value: ' world', type: 'equal' },
    ]);
  });

  it('builds side-by-side diff panes and stats', () => {
    const panes = buildDiffPanes('a\nold\nremoved\n', 'a\nnew\n');

    expect(panes.leftLines.map((line) => line.type)).toEqual(['equal', 'modified', 'removed']);
    expect(panes.rightLines.map((line) => line.type)).toEqual(['equal', 'modified', 'empty']);
    expect(calculateDiffStats(panes.leftLines, panes.rightLines)).toEqual({ added: 1, removed: 2 });
  });

  it('aligns pure insertions with empty rows on the opposite pane', () => {
    const panes = buildDiffPanes('a\n', 'a\nb\n');

    expect(panes.leftLines.map((line) => line.type)).toEqual(['equal', 'empty']);
    expect(panes.rightLines.map((line) => line.type)).toEqual(['equal', 'added']);
  });
});
