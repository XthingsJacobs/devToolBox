import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SafeHtml, { sanitizeHtml } from '..';

describe('SafeHtml', () => {
  it('keeps supported rich text while removing executable markup', () => {
    const html = sanitizeHtml(
      '<div class="table-wrap"><sub>2</sub><a href="javascript:alert(1)" onclick="alert(1)">link</a><script>alert(1)</script><iframe src="https://example.com"></iframe></div>',
      'rich-text',
    );

    expect(html).toContain('<div class="table-wrap"><sub>2</sub><a>link</a></div>');
    expect(html).not.toMatch(/javascript:|onclick|script|iframe/);
  });

  it('allows only span classes in syntax-highlighted output', () => {
    const html = sanitizeHtml(
      '<span class="json-key" onclick="alert(1)">"safe"</span><img src=x onerror=alert(1)><a href="https://example.com">value</a>',
      'syntax',
    );

    expect(html).toBe('<span class="json-key">"safe"</span>value');
  });

  it('renders sanitized content through the requested semantic element', () => {
    const { container } = render(
      <SafeHtml
        as="code"
        className="highlight"
        profile="syntax"
        html={'<span class="hljs-string">value</span><script>alert(1)</script>'}
      />,
    );

    expect(container.querySelector('code.highlight .hljs-string')).toHaveTextContent('value');
    expect(container.querySelector('script')).toBeNull();
  });
});
