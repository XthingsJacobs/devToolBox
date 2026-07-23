import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category, Module } from '../../../types';
import ToolsPage from '../index';

const mocks = vi.hoisted(() => ({ loader: vi.fn() }));

vi.mock('../../../data/placeholder', () => ({
  moduleEntryLoaderMap: new Map([['core-failing', mocks.loader]]),
  modulePluginEntryUrlMap: new Map(),
}));
vi.mock('../../PluginHost', () => ({ default: () => null }));
vi.mock('../../ToolListPanel', () => ({ default: () => null }));
vi.mock('../../ToolTabs', () => ({ default: () => null }));

const module: Module = {
  id: 'core-failing',
  name: 'Recoverable formatter',
  description: 'Test tool',
  categoryId: 'dev-tools',
};
const categories: Category[] = [{ id: 'dev-tools', name: 'Developer tools', icon: null, modules: [module] }];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ToolsPage module loading', () => {
  it('shows the import error and loads the module again only after retry', async () => {
    mocks.loader
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce({ default: () => <div>Recovered module</div> });

    render(
      <ToolsPage
        categories={categories}
        selectedCategoryId="dev-tools"
        selectedModuleId="core-failing"
        openedTools={[{ categoryId: 'dev-tools', module }]}
        onCategorySelect={vi.fn()}
        onOpenTool={vi.fn()}
        onActivateTool={vi.fn()}
        onCloseTool={vi.fn()}
        marketplacePlugins={[]}
        isFullscreen={false}
        onSetFullscreen={vi.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('chunk unavailable');
    expect(mocks.loader).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Recovered module')).toBeInTheDocument());
    expect(mocks.loader).toHaveBeenCalledTimes(2);
  });
});
