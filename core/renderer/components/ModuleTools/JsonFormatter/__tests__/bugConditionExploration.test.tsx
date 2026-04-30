/**
 * Bug Condition Exploration Test — Property 1: Fault Condition
 *
 * isBugCondition:
 *   (key == 'f') AND (metaKey OR ctrlKey) AND textareaFocused AND !searchBarVisible
 *
 * expectedBehavior:
 *   preventDefault is called AND search UI is visible AND highlight overlay exists
 *
 * This test should fail on the buggy code and pass after the fix.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JsonFormatter from '../index';

// Mock dependencies to avoid unrelated rendering issues
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

describe('Bug Condition Exploration: Cmd/Ctrl+F is not intercepted', () => {
  it('when textarea is focused, Cmd+F prevents the browser default (preventDefault)', () => {
    render(<JsonFormatter />);
    const textarea = screen.getByPlaceholderText('Paste JSON string here...');
    textarea.focus();

    const prevented = fireEvent.keyDown(textarea, {
      key: 'f',
      code: 'KeyF',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    // fireEvent.keyDown returns false when preventDefault was called
    expect(prevented).toBe(false);
  });

  it('after Cmd+F, the search input exists in the DOM', () => {
    render(<JsonFormatter />);
    const textarea = screen.getByPlaceholderText('Paste JSON string here...');
    textarea.focus();

    fireEvent.keyDown(textarea, {
      key: 'f',
      code: 'KeyF',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    const searchInput = screen.queryByPlaceholderText('Find...');
    expect(searchInput).toBeInTheDocument();
  });

  it('after Cmd+F, the highlight overlay exists in the DOM', () => {
    render(<JsonFormatter />);
    const textarea = screen.getByPlaceholderText('Paste JSON string here...');
    textarea.focus();

    fireEvent.keyDown(textarea, {
      key: 'f',
      code: 'KeyF',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    const overlay = document.querySelector('.highlightOverlay');
    expect(overlay).toBeInTheDocument();
  });

  it('Ctrl+F also prevents the browser default (cross-platform)', () => {
    render(<JsonFormatter />);
    const textarea = screen.getByPlaceholderText('Paste JSON string here...');
    textarea.focus();

    const prevented = fireEvent.keyDown(textarea, {
      key: 'f',
      code: 'KeyF',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    expect(prevented).toBe(false);
  });
});
