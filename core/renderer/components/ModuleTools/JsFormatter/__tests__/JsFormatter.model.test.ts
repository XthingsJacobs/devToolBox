import { describe, expect, it } from 'vitest';
import { DEFAULT_JS, getJsTextStats } from '../JsFormatter.model';

describe('JsFormatter model', () => {
  it('provides the default JavaScript sample', () => {
    expect(DEFAULT_JS).toContain('function greet');
    expect(DEFAULT_JS).toContain('greet("World")');
  });

  it('computes input and output statistics using existing empty-text semantics', () => {
    expect(getJsTextStats('const a = 1;\nconsole.log(a);', 1)).toEqual({ length: 28, lines: 2 });
    expect(getJsTextStats('', 1)).toEqual({ length: 0, lines: 1 });
    expect(getJsTextStats('', 0)).toEqual({ length: 0, lines: 0 });
  });
});
