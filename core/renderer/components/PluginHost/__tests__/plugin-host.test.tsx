import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PluginHost from '../index';

vi.mock('../../../theme', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('../../../i18n', () => ({ useI18n: () => ({ locale: 'en' }) }));

function pluginFrame(): HTMLIFrameElement {
  return screen.getByTitle('market-sample');
}

function dispatchReady(frame: HTMLIFrameElement) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'devtoolbox:plugin:ready' },
        source: frame.contentWindow,
        origin: 'devtoolbox-plugin://market-sample',
      }),
    );
  });
}

async function dispatchSdkRequest(frame: HTMLIFrameElement, method: string, params?: unknown) {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'devtoolbox:sdk:request', requestId: `req:${method}`, method, params },
        source: frame.contentWindow,
        origin: 'devtoolbox-plugin://market-sample',
      }),
    );
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PluginHost lifecycle', () => {
  it('waits for the SDK ready signal for marketplace plugins', () => {
    render(<PluginHost pluginId="market-sample" entryUrl="devtoolbox-plugin://market-sample/index.html" />);
    const frame = pluginFrame();
    vi.spyOn(frame.contentWindow as Window, 'postMessage').mockImplementation(() => undefined);

    fireEvent.load(frame);
    expect(screen.getByRole('status')).toHaveTextContent('Starting plugin...');

    dispatchReady(frame);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a timeout and rebuilds the iframe when reloading', () => {
    render(<PluginHost pluginId="market-sample" entryUrl="devtoolbox-plugin://market-sample/index.html" />);
    const firstFrame = pluginFrame();

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Plugin startup timed out');

    fireEvent.click(screen.getByRole('button', { name: 'Reload plugin' }));
    expect(screen.getByRole('status')).toHaveTextContent('Starting plugin...');
    expect(pluginFrame()).not.toBe(firstFrame);
  });

  it('treats an ordinary built-in iframe load as ready without an SDK handshake', () => {
    render(<PluginHost pluginId="market-sample" entryUrl="/built-in/index.html" />);
    const frame = pluginFrame();
    vi.spyOn(frame.contentWindow as Window, 'postMessage').mockImplementation(() => undefined);

    fireEvent.load(frame);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('surfaces iframe load errors and offers recovery', () => {
    render(<PluginHost pluginId="market-sample" entryUrl="/broken/index.html" />);

    fireEvent.error(pluginFrame());
    expect(screen.getByRole('alert')).toHaveTextContent('Plugin failed to load');
    expect(screen.getByRole('button', { name: 'Reload plugin' })).toBeEnabled();
  });

  it('records plugin logs and SDK calls in the runtime console', async () => {
    render(<PluginHost pluginId="market-sample" entryUrl="devtoolbox-plugin://market-sample/index.html" />);
    const frame = pluginFrame();
    vi.spyOn(frame.contentWindow as Window, 'postMessage').mockImplementation(() => undefined);

    fireEvent.load(frame);
    dispatchReady(frame);
    await dispatchSdkRequest(frame, 'log.info', { message: 'hello from plugin', data: { count: 1 } });

    fireEvent.click(screen.getByRole('button', { name: /Console/ }));

    expect(screen.getByRole('region', { name: 'Console' })).toHaveTextContent('hello from plugin');
    expect(screen.getByRole('region', { name: 'Console' })).toHaveTextContent('log.info ok');
    expect(screen.getByRole('region', { name: 'Console' })).toHaveTextContent('{"count":1}');
  });
});
