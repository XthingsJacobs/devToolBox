import { describe, expect, it } from 'vitest';
import {
  beautifyHtml,
  compressHtml,
  createHtmlPreview,
  DEFAULT_HTML,
  getHtmlTextStats,
} from '../HtmlEditor.model';

describe('HtmlEditor model', () => {
  it('provides the default HTML sample and text statistics', () => {
    expect(DEFAULT_HTML).toContain('<h1>Hello World</h1>');
    expect(getHtmlTextStats('<p>a</p>\n<p>b</p>')).toEqual({ length: 17, lines: 2 });
    expect(getHtmlTextStats('')).toEqual({ length: 0, lines: 1 });
  });

  it('injects charset and scrollbar styles into preview HTML', () => {
    const html = createHtmlPreview('<html><head></head><body>Hi</body></html>');

    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('::-webkit-scrollbar');
    expect(html).toContain('</head>');
  });

  it('compresses HTML with the existing minification semantics', () => {
    expect(compressHtml('<div>\n  <span> A </span>\n</div>')).toBe('<div><span> A </span></div>');
  });

  it('beautifies nested HTML with two-space indentation', () => {
    expect(beautifyHtml('<div><p>Hello</p><br></div>')).toBe(
      '<div>\n  <p>\n    Hello\n  </p>\n  <br>\n</div>',
    );
  });
});
