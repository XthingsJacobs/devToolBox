import { useEffect, useMemo, useRef, useState } from 'react';
import { sdk } from './sdk';

type CurrenciesMap = Record<string, string>;
type LatestResponse = { amount: number; base: string; date: string; rates: Record<string, number> };

type Settings = {
  base: string;
  targets: string[];
  amount: string;
  spreadPct: string;
  feePct: string;
  decimals: string;
  autoRefreshMin: string;
};

const defaultSettings: Settings = {
  base: 'USD',
  targets: ['EUR', 'CNY', 'JPY', 'GBP'],
  amount: '100',
  spreadPct: '0',
  feePct: '0',
  decimals: '4',
  autoRefreshMin: '0',
};

const currencyToRegion: Record<string, string> = {
  AED: 'AE',
  ARS: 'AR',
  AUD: 'AU',
  BDT: 'BD',
  BGN: 'BG',
  BRL: 'BR',
  CAD: 'CA',
  CHF: 'CH',
  CLP: 'CL',
  CNY: 'CN',
  COP: 'CO',
  CZK: 'CZ',
  DKK: 'DK',
  EGP: 'EG',
  EUR: 'EU',
  GBP: 'GB',
  HKD: 'HK',
  HUF: 'HU',
  IDR: 'ID',
  ILS: 'IL',
  INR: 'IN',
  ISK: 'IS',
  JPY: 'JP',
  KES: 'KE',
  KRW: 'KR',
  LKR: 'LK',
  MXN: 'MX',
  MYR: 'MY',
  NGN: 'NG',
  NOK: 'NO',
  NZD: 'NZ',
  PEN: 'PE',
  PHP: 'PH',
  PKR: 'PK',
  PLN: 'PL',
  RON: 'RO',
  RUB: 'RU',
  SAR: 'SA',
  SEK: 'SE',
  SGD: 'SG',
  THB: 'TH',
  TRY: 'TR',
  UAH: 'UA',
  USD: 'US',
  VND: 'VN',
  ZAR: 'ZA',
};

function regionToFlag(region: string): string {
  const cc = region.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️';
  const a = 0x1f1e6;
  return String.fromCodePoint(a + cc.charCodeAt(0) - 65, a + cc.charCodeAt(1) - 65);
}

function flagForCurrency(code: string): string {
  const c = code.toUpperCase();
  const region = currencyToRegion[c] ?? (c.length >= 2 ? c.slice(0, 2) : '');
  if (!/^[A-Z]{2}$/.test(region)) return '🏳️';
  if (region.startsWith('X') || region.startsWith('Z')) return '🏳️';
  return regionToFlag(region);
}

function nowText(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function num(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

function clampIntString(v: string, min: number, max: number, fallback: number): string {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return String(fallback);
  return String(Math.max(min, Math.min(max, n)));
}

export default function App() {
  const [currencies, setCurrencies] = useState<CurrenciesMap>({});
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [rateDate, setRateDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [search, setSearch] = useState('');

  const saveTimerRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const base = settings.base;
  const targets = settings.targets;

  const amountNum = useMemo(() => num(settings.amount) ?? 0, [settings.amount]);
  const spreadPct = useMemo(() => num(settings.spreadPct) ?? 0, [settings.spreadPct]);
  const feePct = useMemo(() => num(settings.feePct) ?? 0, [settings.feePct]);
  const decimals = useMemo(() => Number(clampIntString(settings.decimals, 0, 8, 4)), [settings.decimals]);

  const filteredCurrencies = useMemo(() => {
    const q = search.trim().toLowerCase();
    const entries = Object.entries(currencies);
    entries.sort(([a], [b]) => a.localeCompare(b));
    if (!q) return entries;
    return entries.filter(([code, name]) => code.toLowerCase().includes(q) || name.toLowerCase().includes(q));
  }, [currencies, search]);

  const rows = useMemo(() => {
    const out = [];
    for (const c of targets) {
      const rate = rates[c];
      if (!rate || !Number.isFinite(rate)) continue;
      const raw = amountNum * rate;
      const withSpread = raw * (1 + spreadPct / 100);
      const afterFee = withSpread * (1 - feePct / 100);
      const inv = rate !== 0 ? 1 / rate : null;
      out.push({
        code: c,
        name: currencies[c] || '',
        rate,
        inv,
        raw,
        withSpread,
        afterFee,
      });
    }
    out.sort((a, b) => a.code.localeCompare(b.code));
    return out;
  }, [targets, rates, amountNum, spreadPct, feePct, currencies]);

  const loadCurrencies = async () => {
    const res = await sdk.http.request<CurrenciesMap>({
      url: 'https://api.frankfurter.app/currencies',
      responseType: 'json',
      timeoutMs: 15000,
    });
    if (!res.ok) throw new Error(res.error.message);
    const body = (res.data?.data ?? {}) as unknown;
    if (!body || typeof body !== 'object') throw new Error('Invalid currencies response');
    setCurrencies(body as CurrenciesMap);
  };

  const loadSettings = async () => {
    const res = await sdk.storage.get('exchange.settings');
    if (!res.ok) return;
    const raw = res.data as unknown;
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<Settings>;
    setSettings((s) => ({
      ...s,
      base: typeof r.base === 'string' && r.base ? r.base : s.base,
      targets: Array.isArray(r.targets) ? r.targets.filter((x): x is string => typeof x === 'string') : s.targets,
      amount: typeof r.amount === 'string' ? r.amount : s.amount,
      spreadPct: typeof r.spreadPct === 'string' ? r.spreadPct : s.spreadPct,
      feePct: typeof r.feePct === 'string' ? r.feePct : s.feePct,
      decimals: typeof r.decimals === 'string' ? r.decimals : s.decimals,
      autoRefreshMin: typeof r.autoRefreshMin === 'string' ? r.autoRefreshMin : s.autoRefreshMin,
    }));
  };

  const saveSettingsSoon = (next: Settings) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void sdk.storage.set('exchange.settings', next);
    }, 250);
  };

  const refresh = async (opts?: { silent?: boolean }) => {
    setError('');
    if (!opts?.silent) setLoading(true);
    try {
      const to = targets.filter(Boolean).join(',');
      const url = new URL('https://api.frankfurter.app/latest');
      url.searchParams.set('from', base);
      if (to) url.searchParams.set('to', to);
      const res = await sdk.http.request<LatestResponse>({
        url: url.toString(),
        responseType: 'json',
        timeoutMs: 15000,
      });
      if (!res.ok) throw new Error(res.error.message);
      const body = res.data?.data as unknown;
      if (!body || typeof body !== 'object') throw new Error('Invalid rates response');
      const r = body as LatestResponse;
      setRates(r.rates || {});
      setRateDate(String(r.date || ''));
      setLastUpdated(nowText());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadSettings();
      } finally {
        try {
          await loadCurrencies();
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, []);

  useEffect(() => {
    saveSettingsSoon(settings);
  }, [settings]);

  useEffect(() => {
    void refresh({ silent: true });
  }, [base, targets.join(',')]);

  useEffect(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    const mins = num(settings.autoRefreshMin) ?? 0;
    if (!mins || mins <= 0) return;
    const ms = Math.max(10_000, Math.floor(mins * 60_000));
    refreshTimerRef.current = window.setInterval(() => void refresh({ silent: true }), ms) as unknown as number;
    return () => {
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current);
    };
  }, [settings.autoRefreshMin, base, targets.join(',')]);

  const toggleTarget = (code: string) => {
    setSettings((s) => {
      const set = new Set(s.targets);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...s, targets: Array.from(set).filter(Boolean) };
    });
  };

  const clearTargets = () => {
    setSettings((s) => ({ ...s, targets: [] }));
  };

  const reset = () => {
    setSettings(defaultSettings);
  };

  const onBaseChange = (v: string) => {
    setSettings((s) => {
      const next = { ...s, base: v };
      if (next.targets.includes(v)) next.targets = next.targets.filter((x) => x !== v);
      return next;
    });
  };

  const baseOptions = useMemo(() => {
    const entries = Object.keys(currencies).sort((a, b) => a.localeCompare(b));
    if (entries.length === 0) return [base];
    return entries;
  }, [currencies, base]);

  return (
    <div className="app">
      <div className="top">
        <div>
          <div className="title">FX Rates / Currency Converter</div>
          <div className="sub">
            Source: api.frankfurter.app{rateDate ? ` (rate date: ${rateDate})` : ''}{' '}
            {lastUpdated ? `· updated: ${lastUpdated}` : ''}
          </div>
        </div>
        <div className="actions">
          <button disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button disabled={loading} onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="grid">
        <div className="card">
          <div className="cardTitle">Query</div>

          <div className="formRow">
            <div className="label">Base</div>
            <select value={base} onChange={(e) => onBaseChange(e.target.value)}>
              {baseOptions.map((c) => (
                <option key={c} value={c}>
                  {flagForCurrency(c)} {c} {currencies[c] ? `- ${currencies[c]}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="formRow">
            <div className="label">Amount</div>
            <input value={settings.amount} onChange={(e) => setSettings((s) => ({ ...s, amount: e.target.value }))} />
          </div>

          <div className="formRow">
            <div className="label">Auto refresh</div>
            <select
              value={settings.autoRefreshMin}
              onChange={(e) => setSettings((s) => ({ ...s, autoRefreshMin: e.target.value }))}
            >
              <option value="0">Off</option>
              <option value="1">1 min</option>
              <option value="5">5 min</option>
              <option value="15">15 min</option>
              <option value="60">60 min</option>
            </select>
          </div>
        </div>

        <div className="card">
          <div className="cardTitle">Calculator</div>
          <div className="hint">Result = amount × rate × (1 + spread%) × (1 - fee%)</div>

          <div className="formRow">
            <div className="label">Spread(%)</div>
            <input
              value={settings.spreadPct}
              onChange={(e) => setSettings((s) => ({ ...s, spreadPct: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="formRow">
            <div className="label">Fee(%)</div>
            <input
              value={settings.feePct}
              onChange={(e) => setSettings((s) => ({ ...s, feePct: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="formRow">
            <div className="label">Decimals</div>
            <input
              value={settings.decimals}
              onChange={(e) => setSettings((s) => ({ ...s, decimals: clampIntString(e.target.value, 0, 8, 4) }))}
            />
          </div>
        </div>

        <div className="card targets">
          <div className="cardTop">
            <div className="cardTitle">Targets ({targets.length})</div>
            <div className="cardActions">
              <button onClick={clearTargets}>Clear</button>
            </div>
          </div>
          <input
            className="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or name (e.g. CNY / yuan)"
          />
          <div className="list">
            {filteredCurrencies.map(([code, name]) => {
              const checked = targets.includes(code);
              const disabled = code === base;
              return (
                <label key={code} className={`item ${disabled ? 'disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleTarget(code)}
                  />
                  <span className="codeWrap">
                    <span className="flag" aria-hidden="true">
                      {flagForCurrency(code)}
                    </span>
                    <span className="code">{code}</span>
                  </span>
                  <span className="name">{name}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="card tableCard">
          <div className="cardTitle">Rates</div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>
                    Rate (1 {flagForCurrency(base)} {base})
                  </th>
                  <th>Conversion</th>
                  <th className="muted">Inverse</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((r) => (
                    <tr key={r.code}>
                      <td>
                        <div className="cellMain">
                          <span className="flag" aria-hidden="true">
                            {flagForCurrency(r.code)}
                          </span>
                          <span className="code">{r.code}</span>
                          <span className="muted">{r.name}</span>
                        </div>
                      </td>
                      <td>{r.rate.toFixed(decimals)}</td>
                      <td>
                        <div className="cellCol">
                          <div>
                            <span className="muted">Raw: </span>
                            {r.raw.toFixed(decimals)}
                          </div>
                          <div>
                            <span className="muted">With spread: </span>
                            {r.withSpread.toFixed(decimals)}
                          </div>
                          <div>
                            <span className="muted">Final: </span>
                            {r.afterFee.toFixed(decimals)}
                          </div>
                        </div>
                      </td>
                      <td className="muted">
                        {r.inv
                          ? `${flagForCurrency(r.code)} 1 ${r.code} ≈ ${r.inv.toFixed(decimals)} ${flagForCurrency(base)} ${base}`
                          : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="empty">
                      {targets.length === 0 ? 'Select target currencies' : loading ? 'Loading…' : 'No data (click Refresh)'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="foot">
            Note: This tool is for quick lookup and calculation. For financial-grade accuracy and compliance, use your broker/bank quotes.
          </div>
        </div>
      </div>
    </div>
  );
}
