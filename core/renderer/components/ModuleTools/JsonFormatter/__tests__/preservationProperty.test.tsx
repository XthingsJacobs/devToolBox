/**
 * Preservation Property Tests — Property 2
 *
 * Verify that non-Cmd/Ctrl+F behavior stays unchanged across refactors.
 * These tests should pass on the old behavior and continue to pass after changes (no regressions).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import JsonFormatter from '../index';

// Mock dependencies
vi.mock('@@components', () => ({
  JsonTreeView: () => <div data-testid="json-tree-view" />,
  useSplitPane: () => ({ splitPercent: 50, containerRef: { current: null }, handleMouseDown: () => {} }),
  HelpModal: () => null,
  ToolSection: ({ title, actions, children }: any) => (
    <section>
      <header>
        <span>{title}</span>
        {actions}
      </header>
      <div>{children}</div>
    </section>
  ),
}));
vi.mock('../../../../components/ResponsiveActions', () => ({
  default: ({ actions }: { actions: { label: string; onClick: () => void }[] }) => (
    <div data-testid="responsive-actions">
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
}));

describe('Preservation: non-Cmd/Ctrl+F behavior remains unchanged', () => {
  // --- Property: text input triggers JSON parsing and formatting (Req 3.1) ---

  it('for any valid JSON input, the component parses and shows the JsonTreeView', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (jsonValue) => {
        const jsonStr = JSON.stringify(jsonValue);
        const { unmount } = render(<JsonFormatter />);
        const textarea = screen.getByPlaceholderText('Paste JSON string here...');

        fireEvent.change(textarea, { target: { value: jsonStr } });

        // Valid JSON shows the tree view and no error
        expect(screen.getByTestId('json-tree-view')).toBeInTheDocument();
        unmount();
      }),
      { numRuns: 20 },
    );
  });

  it('for any invalid JSON input, the component shows an error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => {
          if (!s.trim()) return false;
          try {
            JSON.parse(s);
            return false;
          } catch {
            return true;
          }
        }),
        async (invalidJson) => {
          const { unmount, container } = render(<JsonFormatter />);
          const textarea = screen.getByPlaceholderText('Paste JSON string here...');

          fireEvent.change(textarea, { target: { value: invalidJson } });

          await waitFor(() => {
            const errorEl = container.querySelector('pre');
            expect(errorEl).not.toBeNull();
            expect(errorEl?.textContent?.trim()).toBeTruthy();
          });
          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('empty input shows neither error nor tree view', () => {
    const { container } = render(<JsonFormatter />);
    const textarea = screen.getByPlaceholderText('Paste JSON string here...');

    fireEvent.change(textarea, { target: { value: '' } });

    expect(screen.queryByTestId('json-tree-view')).not.toBeInTheDocument();
    expect(container.querySelector('pre')).not.toBeInTheDocument();
  });

  // --- Property: shortcuts other than Cmd/Ctrl+F are not prevented (Req 3.2) ---

  it('for any shortcut other than Cmd/Ctrl+F, default behavior is not prevented', () => {
    const nonFKeys = ['a', 'c', 'v', 'z', 'x'] as const;

    fc.assert(
      fc.property(fc.constantFrom(...nonFKeys), fc.boolean(), (key, useMeta) => {
        const { unmount } = render(<JsonFormatter />);
        const textarea = screen.getByPlaceholderText('Paste JSON string here...');
        textarea.focus();

        const prevented = fireEvent.keyDown(textarea, {
          key,
          code: `Key${key.toUpperCase()}`,
          metaKey: useMeta,
          ctrlKey: !useMeta,
          bubbles: true,
          cancelable: true,
        });

        // fireEvent returns true when preventDefault was not called
        expect(prevented).toBe(true);
        unmount();
      }),
      { numRuns: 10 },
    );
  });

  it('normal character keys are not prevented', () => {
    fc.assert(
      fc.property(
        fc.char().filter((c) => c !== 'f' && c !== 'F'),
        (key) => {
          const { unmount } = render(<JsonFormatter />);
          const textarea = screen.getByPlaceholderText('Paste JSON string here...');
          textarea.focus();

          const prevented = fireEvent.keyDown(textarea, {
            key,
            bubbles: true,
            cancelable: true,
          });

          expect(prevented).toBe(true);
          unmount();
        },
      ),
      { numRuns: 15 },
    );
  });

  // --- Property: Clear button resets state (Req 3.3) ---

  it('clicking Clear resets textarea and hides results/errors', () => {
    const { container } = render(<JsonFormatter />);
    const textarea = screen.getByPlaceholderText('Paste JSON string here...');

    // Enter valid JSON first
    fireEvent.change(textarea, { target: { value: '{"a":1}' } });
    expect(screen.getByTestId('json-tree-view')).toBeInTheDocument();

    // Click Clear
    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);

    // Textarea is empty, no results, no errors
    expect(textarea).toHaveValue('');
    expect(screen.queryByTestId('json-tree-view')).not.toBeInTheDocument();
    expect(container.querySelector('pre')).not.toBeInTheDocument();
  });

  it('after clearing, state is reset for any valid JSON input', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (jsonValue) => {
        const jsonStr = JSON.stringify(jsonValue);
        const { unmount, container } = render(<JsonFormatter />);
        const textarea = screen.getByPlaceholderText('Paste JSON string here...');

        fireEvent.change(textarea, { target: { value: jsonStr } });
        const clearBtn = screen.getByText('Clear');
        fireEvent.click(clearBtn);

        expect(textarea).toHaveValue('');
        expect(screen.queryByTestId('json-tree-view')).not.toBeInTheDocument();
        expect(container.querySelector('pre')).not.toBeInTheDocument();
        unmount();
      }),
      { numRuns: 15 },
    );
  });

  // --- Property: normal editing is unaffected when search is closed (Req 3.4) ---

  it('sequential input changes are reflected in the textarea', () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 5 }), (inputs) => {
        const { unmount } = render(<JsonFormatter />);
        const textarea = screen.getByPlaceholderText('Paste JSON string here...');

        for (const val of inputs) {
          fireEvent.change(textarea, { target: { value: val } });
          expect(textarea).toHaveValue(val);
        }
        unmount();
      }),
      { numRuns: 10 },
    );
  });

  // --- Property: Select File button is clickable (Req 3.3) ---

  it('Select File button exists and is clickable', () => {
    render(<JsonFormatter />);
    const fileBtn = screen.getByText('Select File');
    expect(fileBtn).toBeInTheDocument();
    // Clicking should not throw
    expect(() => fireEvent.click(fileBtn)).not.toThrow();
  });
});
