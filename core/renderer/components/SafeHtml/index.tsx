import DOMPurify, { type Config } from 'dompurify';
import { createElement, forwardRef, useMemo, type HTMLAttributes } from 'react';

export type SafeHtmlProfile = 'rich-text' | 'syntax';

const richTextConfig: Config = {
  ALLOWED_TAGS: [
    'a',
    'blockquote',
    'br',
    'code',
    'del',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'kbd',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'ul',
  ],
  ALLOWED_ATTR: ['class', 'colspan', 'href', 'rowspan', 'title'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
};

const syntaxConfig: Config = {
  ALLOWED_TAGS: ['span'],
  ALLOWED_ATTR: ['class'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
};

export function sanitizeHtml(html: string, profile: SafeHtmlProfile): string {
  return DOMPurify.sanitize(html, profile === 'syntax' ? syntaxConfig : richTextConfig);
}

type SafeHtmlElement = 'code' | 'div' | 'pre' | 'span';

export interface SafeHtmlProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  as?: SafeHtmlElement;
  html: string;
  profile: SafeHtmlProfile;
}

const SafeHtml = forwardRef<HTMLElement, SafeHtmlProps>(function SafeHtml(
  { as = 'div', html, profile, ...props },
  ref,
) {
  const sanitizedHtml = useMemo(() => sanitizeHtml(html, profile), [html, profile]);
  return createElement(as, {
    ...props,
    ref,
    dangerouslySetInnerHTML: { __html: sanitizedHtml },
  });
});

export default SafeHtml;
