import { createRoot } from 'react-dom/client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type PluginLocale = 'en' | 'zh-CN';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function applyTheme(value: unknown): void {
  if (value === 'dark' || value === 'light') document.documentElement.dataset.theme = value;
}

function resolvePluginLocale(value: unknown): PluginLocale {
  const raw = String(value ?? '').trim();
  if (raw === 'en' || raw === 'zh-CN') return raw;
  if (raw.toLowerCase().startsWith('zh')) return 'zh-CN';
  return 'en';
}

function applyLocale(value: PluginLocale): void {
  document.documentElement.dataset.locale = value;
  document.documentElement.lang = value;
}

const PluginLocaleContext = createContext<PluginLocale>('en');

export function usePluginLocale(): PluginLocale {
  return useContext(PluginLocaleContext);
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

function PluginEnvironment({
  hostOrigin,
  localeEnabled,
  initialLocale,
  children,
}: {
  hostOrigin?: string;
  localeEnabled: boolean;
  initialLocale: PluginLocale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<PluginLocale>(initialLocale);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window.parent || !isRecord(event.data)) return;
      if (hostOrigin && event.origin !== hostOrigin) return;
      if (event.data.type === 'devtoolbox:theme') applyTheme(event.data.theme);
      if (localeEnabled && event.data.type === 'devtoolbox:locale')
        setLocale(resolvePluginLocale(event.data.locale));
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [hostOrigin, localeEnabled]);

  useEffect(() => {
    if (localeEnabled) applyLocale(locale);
  }, [locale, localeEnabled]);

  return <PluginLocaleContext.Provider value={locale}>{children}</PluginLocaleContext.Provider>;
}

export function mountPlugin(app: ReactNode, options?: { locale?: boolean }): () => void {
  const query = new URLSearchParams(window.location.search);
  const configuredHostOrigin = query.get('hostOrigin');
  const hostOrigin =
    configuredHostOrigin && configuredHostOrigin !== 'null' ? configuredHostOrigin : undefined;
  const localeEnabled = Boolean(options?.locale);
  const initialLocale = resolvePluginLocale(query.get('locale') ?? navigator.language);
  applyTheme(query.get('theme'));
  if (localeEnabled) applyLocale(initialLocale);

  const root = document.getElementById('root');
  if (!root) throw new Error('Plugin root element not found');
  const reactRoot = createRoot(root);
  reactRoot.render(
    <PluginEnvironment hostOrigin={hostOrigin} localeEnabled={localeEnabled} initialLocale={initialLocale}>
      <PluginReadySignal hostOrigin={hostOrigin} />
      {app}
    </PluginEnvironment>,
  );
  return () => reactRoot.unmount();
}
