import type { JsTextStats } from './JsFormatter.types';

export const DEFAULT_JS = `function greet(name) {
  const message = "Hello, " + name + "!";
  console.log(message);
  return message;
}

greet("World");`;

export function getJsTextStats(text: string, emptyLineCount: 0 | 1): JsTextStats {
  return {
    length: text.length,
    lines: text ? (text.match(/\n/g) || []).length + 1 : emptyLineCount,
  };
}
