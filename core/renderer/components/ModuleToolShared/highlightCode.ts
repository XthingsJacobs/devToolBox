import hljs from '../../lib/highlight';

export function highlightCode(text: string, language: string) {
  if (!text) return '';
  try {
    return hljs.highlight(text, { language }).value;
  } catch {
    return hljs.highlightAuto(text).value;
  }
}
