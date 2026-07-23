import { createRoot } from 'react-dom/client';
import { useEffect, type ReactNode } from 'react';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function applyTheme(value: unknown): void {
  if (value === 'dark' || value === 'light') document.documentElement.dataset.theme = value;
}

function applyLocale(value: unknown): void {
  if (value !== 'en' && value !== 'zh-CN') return;
  document.documentElement.dataset.locale = value;
  document.documentElement.lang = value;
}

function PluginReadySignal({ hostOrigin }: { hostOrigin?: string }) {
  useEffect(() => {
    let attempts = 0;
    let timer: number | undefined;

    const stop = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('message', handleAck);
    };
    const handleAck = (event: MessageEvent) => {
      if (event.source !== window.parent || !isRecord(event.data)) return;
      if (hostOrigin && event.origin !== hostOrigin) return;
      if (event.data.type === 'devtoolbox:plugin:ready:ack') stop();
    };
    const announce = () => {
      attempts += 1;
      try {
        window.parent.postMessage({ type: 'devtoolbox:plugin:ready' }, hostOrigin ?? '*');
      } catch {
        // Retry transient postMessage failures during plugin bootstrap.
      }
      if (attempts < 20) timer = window.setTimeout(announce, 250);
      else stop();
    };

    window.addEventListener('message', handleAck);
    announce();
    return stop;
  }, [hostOrigin]);

  return null;
}

export function mountPlugin(app: ReactNode, options?: { locale?: boolean }): () => void {
  const query = new URLSearchParams(window.location.search);
  const configuredHostOrigin = query.get('hostOrigin');
  const hostOrigin =
    configuredHostOrigin && configuredHostOrigin !== 'null' ? configuredHostOrigin : undefined;
  applyTheme(query.get('theme'));
  if (options?.locale) applyLocale(query.get('locale'));

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !isRecord(event.data)) return;
    if (hostOrigin && event.origin !== hostOrigin) return;
    if (event.data.type === 'devtoolbox:theme') applyTheme(event.data.theme);
    if (options?.locale && event.data.type === 'devtoolbox:locale') applyLocale(event.data.locale);
  });

  const root = document.getElementById('root');
  if (!root) throw new Error('Plugin root element not found');
  const reactRoot = createRoot(root);
  reactRoot.render(
    <>
      <PluginReadySignal hostOrigin={hostOrigin} />
      {app}
    </>,
  );
  return () => reactRoot.unmount();
}
