import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';
export type ThemeSetting = 'auto' | Theme;

const THEME_SETTING_KEY = 'devtoolbox_theme_setting';

function resolveSystemTheme(): Theme {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(setting: ThemeSetting): Theme {
  if (setting === 'auto') return resolveSystemTheme();
  return setting;
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

interface ThemeContextValue {
  setting: ThemeSetting;
  theme: Theme;
  setThemeSetting: (s: ThemeSetting) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  setting: 'auto',
  theme: 'dark',
  setThemeSetting: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSetting] = useState<ThemeSetting>(() => {
    const raw = localStorage.getItem(THEME_SETTING_KEY) || '';
    if (raw === 'auto' || raw === 'dark' || raw === 'light') return raw;
    localStorage.setItem(THEME_SETTING_KEY, 'auto');
    return 'auto';
  });

  const [theme, setTheme] = useState<Theme>(() => resolveTheme(setting));

  const setThemeSetting = useCallback((s: ThemeSetting) => {
    setSetting(s);
    localStorage.setItem(THEME_SETTING_KEY, s);
    const next = resolveTheme(s);
    setTheme(next);
    applyTheme(next);
    void window.electronAPI?.setTheme?.(s);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getTheme) return;
    void api
      .getTheme()
      .then((res: unknown) => {
        const r = res as { setting?: unknown; theme?: unknown };
        const s = r?.setting;
        const t = r?.theme;
        const nextSetting: ThemeSetting = s === 'auto' || s === 'dark' || s === 'light' ? s : 'auto';
        const nextTheme: Theme = t === 'dark' || t === 'light' ? t : resolveTheme(nextSetting);
        setSetting(nextSetting);
        localStorage.setItem(THEME_SETTING_KEY, nextSetting);
        setTheme(nextTheme);
        applyTheme(nextTheme);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onThemeChanged || !api?.offThemeChanged) return;
    const handler = (_event: unknown, nextTheme: string) => {
      if (nextTheme === 'dark' || nextTheme === 'light') {
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }
      void api.getTheme?.().then((res: unknown) => {
        const r = res as { setting?: unknown };
        const s = r?.setting;
        const nextSetting: ThemeSetting = s === 'auto' || s === 'dark' || s === 'light' ? s : 'auto';
        setSetting(nextSetting);
        localStorage.setItem(THEME_SETTING_KEY, nextSetting);
      });
    };
    api.onThemeChanged(handler);
    return () => api.offThemeChanged(handler);
  }, []);

  useEffect(() => {
    if (setting !== 'auto') return;
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const next = resolveSystemTheme();
      setTheme(next);
      applyTheme(next);
    };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [setting]);

  const value = useMemo(() => ({ setting, theme, setThemeSetting }), [setting, theme, setThemeSetting]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

