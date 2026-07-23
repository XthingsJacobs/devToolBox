import type { HtmlTextStats } from './HtmlEditor.types';

export const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: sans-serif; padding: 20px; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Hello World</h1>
  <p>Edit HTML on the left, live preview on the right.</p>
</body>
</html>`;

const SCROLLBAR_CSS = `<style>
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.4); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.6); }
</style>`;

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export function getHtmlTextStats(text: string): HtmlTextStats {
  return {
    length: text.length,
    lines: (text.match(/\n/g) || []).length + 1,
  };
}

export function createHtmlPreview(input: string): string {
  let html = input;
  if (!html.toLowerCase().includes('<meta') || !html.toLowerCase().includes('charset')) {
    html = html.replace(/(<head[^>]*>)/i, '$1\n<meta charset="UTF-8">');
  }
  if (html.toLowerCase().includes('</head>')) {
    return html.replace(/<\/head>/i, `${SCROLLBAR_CSS}\n</head>`);
  }
  return SCROLLBAR_CSS + html;
}

export function compressHtml(input: string): string {
  return input
    .replace(/\n\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

export function beautifyHtml(input: string): string {
  let result = '';
  let indent = 0;
  const tab = '  ';
  const raw = input.replace(/>\s+</g, '><').trim();
  const tokens = raw.match(/(<[^>]+>|[^<]+)/g) || [];

  for (const token of tokens) {
    if (token.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      result += tab.repeat(indent) + token + '\n';
    } else if (token.startsWith('<')) {
      const tagMatch = token.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
      const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
      const selfClosing = token.endsWith('/>') || VOID_TAGS.has(tagName);
      const isDoctype = token.startsWith('<!');
      result += tab.repeat(indent) + token + '\n';
      if (!selfClosing && !isDoctype && tagName) indent += 1;
    } else {
      const trimmed = token.trim();
      if (trimmed) result += tab.repeat(indent) + trimmed + '\n';
    }
  }

  return result.trimEnd();
}
