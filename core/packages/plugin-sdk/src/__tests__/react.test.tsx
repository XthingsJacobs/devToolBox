import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPlugin } from '../react';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
  document.body.replaceChildren();
});

describe('mountPlugin', () => {
  it('announces readiness after the React tree commits and stops after host acknowledgement', () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="root"></div>';
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
    let unmount: () => void = () => undefined;

    act(() => {
      unmount = mountPlugin(<div>Plugin ready</div>);
    });

    expect(document.body).toHaveTextContent('Plugin ready');
    expect(postMessage).toHaveBeenCalledWith({ type: 'devtoolbox:plugin:ready' }, '*');
    expect(vi.getTimerCount()).toBe(1);

    const acknowledgement = new MessageEvent('message', {
      data: { type: 'devtoolbox:plugin:ready:ack' },
    });
    Object.defineProperty(acknowledgement, 'source', { value: window.parent });
    window.dispatchEvent(acknowledgement);

    expect(vi.getTimerCount()).toBe(0);
    act(() => unmount());
  });
});
