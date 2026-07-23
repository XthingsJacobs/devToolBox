import type { DiagnosticLog, ElectronAPI } from '@devtoolbox/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../index';

vi.mock('../../../theme', () => ({
  useTheme: () => ({ setting: 'dark', setThemeSetting: vi.fn() }),
}));
vi.mock('../../../i18n', () => ({
  useI18n: () => ({ locale: 'en', setting: 'en', setLocale: vi.fn() }),
}));
vi.mock('../../../marketplace/registry', () => ({
  ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL: false,
  DEFAULT_MARKETPLACE_REGISTRY_URL: 'https://example.com/registry.json',
  loadMarketplaceRegistryUrl: vi.fn(() => ''),
  saveMarketplaceRegistryUrl: vi.fn(),
}));

const diagnosticLog: DiagnosticLog = {
  events: [
    {
      id: 'event-1',
      timestamp: '2026-07-20T00:00:00.000Z',
      level: 'error',
      source: 'tool',
      scope: 'JSON Formatter',
      message: 'Formatting failed',
    },
  ],
  droppedCount: 2,
  maxEvents: 500,
  maxBytes: 512 * 1024,
};

function installApi(overrides: Partial<ElectronAPI> = {}) {
  const api = {
    getAppInfo: vi.fn().mockResolvedValue({ version: '2.0.3' }),
    diagnosticsList: vi.fn().mockResolvedValue(diagnosticLog),
    diagnosticsExport: vi.fn().mockResolvedValue({
      success: true,
      filePath: '/tmp/DevToolBox-diagnostics.json',
    }),
    diagnosticsClear: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as ElectronAPI;
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: api });
  return api;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: undefined });
});

describe('Settings diagnostics', () => {
  it('loads recent redacted events and exports a user-requested bundle', async () => {
    const api = installApi();
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    expect(await screen.findByText('Formatting failed')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export bundle' }));
    expect(await screen.findByRole('status')).toHaveTextContent('/tmp/DevToolBox-diagnostics.json');
    expect(api.diagnosticsExport).toHaveBeenCalledOnce();
  });

  it('requires confirmation before clearing the local event log', async () => {
    const emptyLog: DiagnosticLog = { ...diagnosticLog, events: [], droppedCount: 0 };
    const diagnosticsList = vi.fn().mockResolvedValueOnce(diagnosticLog).mockResolvedValue(emptyLog);
    const api = installApi({ diagnosticsList } as Partial<ElectronAPI>);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostics' }));
    await screen.findByText('Formatting failed');
    fireEvent.click(screen.getByRole('button', { name: 'Clear log' }));

    await waitFor(() => expect(api.diagnosticsClear).toHaveBeenCalledOnce());
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(await screen.findByText('No diagnostic events have been recorded.')).toBeInTheDocument();
  });

  it('offers a normal restart while the current session is isolated', async () => {
    installApi();
    const onRestart = vi.fn().mockResolvedValue(true);
    render(
      <SettingsPage
        initialSection="diagnostics"
        startupStatus={{
          safeMode: true,
          reason: 'crash-loop',
          consecutiveFailures: 2,
          failureThreshold: 2,
          startedAt: '2026-07-20T00:00:00.000Z',
        }}
        onRestart={onRestart}
      />,
    );

    expect(await screen.findByText('Safe mode')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restart normally' }));

    await waitFor(() => expect(onRestart).toHaveBeenCalledWith('normal'));
  });
});
