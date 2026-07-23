import { describe, expect, it } from 'vitest';
import {
  createMarkdownPreviewHtml,
  defaultPreviewPalette,
  DEFAULT_MD,
  getMarkdownTextStats,
  resolvePreviewPalette,
} from '../MarkdownPreview.model';

describe('MarkdownPreview model', () => {
  it('provides the default Markdown sample and text statistics', () => {
    expect(DEFAULT_MD).toContain('# Markdown Preview');
    expect(getMarkdownTextStats('a\nb')).toEqual({ length: 3, lines: 2 });
    expect(getMarkdownTextStats('')).toEqual({ length: 0, lines: 1 });
  });

  it('renders Markdown into a sandbox-friendly HTML document', () => {
    const html = createMarkdownPreviewHtml(
      '## Title\n\n```js\nconst value = 1;\n```',
      defaultPreviewPalette(),
      'dark',
    );

    expect(html).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('language-js');
    expect(html).toContain('const');
  });

  it('resolves preview palette from CSS variables with theme fallbacks', () => {
    expect(
      resolvePreviewPalette('light', (key) => (key === '--accent-primary' ? '#123456' : '')),
    ).toMatchObject({
      bg: '#ffffff',
      text: '#24292f',
      link: '#123456',
    });
  });
});
