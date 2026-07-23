import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../index';

const setThemeSetting = vi.hoisted(() => vi.fn());

vi.mock('../../../theme', () => ({
  useTheme: () => ({ setting: 'dark', setThemeSetting }),
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

afterEach(() => {
  cleanup();
  setThemeSetting.mockReset();
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: undefined });
});

describe('Settings appearance', () => {
  it('renders proportional dark, light, and automatic theme previews', () => {
    render(<SettingsPage />);

    const auto = screen.getByRole('button', { name: 'Auto' });
    const dark = screen.getByRole('button', { name: 'Dark' });
    const light = screen.getByRole('button', { name: 'Light' });

    expect(auto.querySelectorAll('[data-preview-theme="auto"]')).toHaveLength(1);
    expect(dark.querySelectorAll('[data-preview-theme="dark"]')).toHaveLength(1);
    expect(light.querySelectorAll('[data-preview-theme="light"]')).toHaveLength(1);
    expect(within(dark).getByText('Dark')).toBeInTheDocument();
    expect(dark).toHaveAttribute('aria-pressed', 'true');
  });

  it('updates the selected theme through the theme context', () => {
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(setThemeSetting).toHaveBeenCalledWith('light');
  });
});
