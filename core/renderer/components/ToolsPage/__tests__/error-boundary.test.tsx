import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolRuntimeBoundary } from '../index';

function RecoverableTool({ broken }: { broken: boolean }) {
  if (broken) throw new Error('formatter crashed');
  return <div>Tool recovered</div>;
}

function Harness({ onClose }: { onClose: () => void }) {
  const [broken, setBroken] = useState(true);
  return (
    <ToolRuntimeBoundary toolName="Formatter" onRetry={() => setBroken(false)} onClose={onClose}>
      <RecoverableTool broken={broken} />
    </ToolRuntimeBoundary>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ToolRuntimeBoundary', () => {
  it('contains a tool crash and retries with a clean render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Harness onClose={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('formatter crashed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('Tool recovered')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('allows the failed tool to be closed without affecting the host page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close tool' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
