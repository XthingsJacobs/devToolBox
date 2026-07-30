import { marked } from 'marked';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import markdownHighlight from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import hljs from '../../../lib/highlight';
import type { MarkdownPreviewPalette, MarkdownTextStats } from './MarkdownPreview.types';

export const DEFAULT_MD = `# Markdown Preview

Edit Markdown on the left, live preview on the right.

## Features

- Open **.md** files
- Manual editing
- Save and Save As
- Code highlighting

\`\`\`js
console.log('Hello, Markdown!');
\`\`\`

> Blockquote example

| Col1 | Col2 |
|------|------|
| A    | B    |
`;

let markdownRenderingConfigured = false;

function configureMarkdownRendering() {
  if (markdownRenderingConfigured) return;
  markdownRenderingConfigured = true;

  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('cpp', cpp);
  hljs.registerLanguage('csharp', csharp);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('markdown', markdownHighlight);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('typescript', typescript);
  marked.setOptions({ breaks: true, gfm: true });
}

const renderer = new marked.Renderer();
renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};

export function getMarkdownTextStats(text: string): MarkdownTextStats {
  return {
    length: text.length,
    lines: (text.match(/\n/g) || []).length + 1,
  };
}

export function resolvePreviewPalette(
  theme: string,
  getCssVariable: (key: string) => string,
): MarkdownPreviewPalette {
  const get = (key: string, fallback: string) => getCssVariable(key).trim() || fallback;

  return {
    bg: get('--bg-secondary', theme === 'dark' ? '#0d1117' : '#ffffff'),
    text: get('--text-primary', theme === 'dark' ? '#e6edf3' : '#24292f'),
    border: get('--border-default', theme === 'dark' ? '#30363d' : '#d0d7de'),
    muted: get('--text-secondary', theme === 'dark' ? '#8b949e' : '#57606a'),
    codeBg: get('--bg-elevated', theme === 'dark' ? '#161b22' : '#f6f8fa'),
    link: get('--accent-primary', theme === 'dark' ? '#58a6ff' : '#0969da'),
  };
}

export function defaultPreviewPalette(): MarkdownPreviewPalette {
  return {
    bg: '#0d1117',
    text: '#e6edf3',
    border: '#30363d',
    muted: '#8b949e',
    codeBg: '#161b22',
    link: '#58a6ff',
  };
}

export function createMarkdownPreviewHtml(
  input: string,
  palette: MarkdownPreviewPalette,
  theme: string,
): string {
  configureMarkdownRendering();
  const body = marked.parse(input, { renderer }) as string;
  const syntax =
    theme === 'dark'
      ? { comment: '#8b949e', keyword: '#ff7b72', string: '#a5d6ff', number: '#79c0ff', title: '#d2a8ff' }
      : { comment: '#6e7781', keyword: '#cf222e', string: '#0a3069', number: '#0550ae', title: '#8250df' };

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'">
<style>
body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; padding: 16px 24px; color: ${palette.text}; background: ${palette.bg}; line-height: 1.6; }
h1,h2,h3,h4,h5,h6 { border-bottom: 1px solid ${palette.border}; padding-bottom: 0.3em; margin-top: 1.5em; }
a { color: ${palette.link}; }
code { background: ${palette.codeBg}; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
pre { background: ${palette.codeBg}; padding: 12px 16px; border-radius: 6px; overflow-x: auto; }
pre code { background: none; padding: 0; }
.hljs-comment,.hljs-quote { color: ${syntax.comment}; }
.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-type { color: ${syntax.keyword}; }
.hljs-string,.hljs-regexp,.hljs-attribute { color: ${syntax.string}; }
.hljs-number,.hljs-symbol,.hljs-bullet { color: ${syntax.number}; }
.hljs-title,.hljs-section,.hljs-name,.hljs-selector-id,.hljs-selector-class { color: ${syntax.title}; }
.hljs-built_in,.hljs-variable,.hljs-template-variable { color: ${palette.link}; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: 700; }
blockquote { border-left: 4px solid ${palette.border}; margin: 0; padding: 0 16px; color: ${palette.muted}; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid ${palette.border}; padding: 6px 12px; }
th { background: ${palette.codeBg}; }
img { max-width: 100%; }
hr { border: none; border-top: 1px solid ${palette.border}; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.4); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.6); }
</style></head><body>${body}</body></html>`;
}
