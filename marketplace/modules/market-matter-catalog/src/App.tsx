import { useEffect, useMemo, useRef, useState } from 'react';
import { sdk } from './sdk';

type ParsedTable = { headers: string[]; rows: string[][] };
type DeviceTypeEntry = { anchorId: string; title: string; clusterTable?: ParsedTable };
type MatterCatalogSettings = { version: string; deviceAnchorId: string; filter: string };

function isHeading(el: Element): el is HTMLHeadingElement {
  return /^H[1-6]$/.test(el.tagName);
}

function headingLevel(el: Element): number {
  if (!isHeading(el)) return 99;
  return Number(el.tagName.slice(1));
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function findHeadingFromAnchor(anchor: Element): Element | null {
  if (isHeading(anchor)) return anchor;
  const parent = anchor.parentElement;
  if (parent && isHeading(parent)) return parent;

  let cur: Element | null = anchor;
  for (let i = 0; i < 80 && cur; i += 1) {
    if (cur.nextElementSibling) {
      cur = cur.nextElementSibling;
      if (isHeading(cur)) return cur;
      continue;
    }
    cur = cur.parentElement;
  }
  return null;
}

function collectSectionElements(start: Element): Element[] {
  const startLevel = headingLevel(start);
  const out: Element[] = [];
  let cur = start.nextElementSibling;
  while (cur) {
    if (isHeading(cur) && headingLevel(cur) <= startLevel) break;
    out.push(cur);
    cur = cur.nextElementSibling;
  }
  return out;
}

function findNextTable(from: Element): HTMLTableElement | null {
  const inside = from.querySelector?.('table') as HTMLTableElement | null;
  if (inside) return inside;
  if (from.tagName === 'TABLE') return from as HTMLTableElement;

  let cur = from.nextElementSibling;
  for (let i = 0; i < 20 && cur; i += 1) {
    const t = cur.querySelector?.('table') as HTMLTableElement | null;
    if (t) return t;
    if (cur.tagName === 'TABLE') return cur as HTMLTableElement;
    if (isHeading(cur)) break;
    cur = cur.nextElementSibling;
  }
  return null;
}

function parseTable(table: HTMLTableElement): ParsedTable {
  const headers = Array.from(table.querySelectorAll('thead th')).map((th) => normalizeText(th.textContent || ''));
  const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) => normalizeText(td.textContent || '')),
  );
  const finalHeaders =
    headers.length && headers.every((h) => h)
      ? headers
      : rows.length
        ? rows[0].map((_, idx) => `Col ${idx + 1}`)
        : [];
  return { headers: finalHeaders, rows };
}

function parseDeviceLibraryHtml(html: string): { title: string; deviceTypes: DeviceTypeEntry[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = normalizeText(doc.querySelector('h1')?.textContent || 'Matter Device Library');
  const anchors = Array.from(doc.querySelectorAll('[id^="ref_"]')).filter((el) => el.id && el.id.startsWith('ref_'));
  const deviceTypes: DeviceTypeEntry[] = [];

  for (const a of anchors) {
    const h = findHeadingFromAnchor(a);
    if (!h) continue;

    const sectionEls = collectSectionElements(h);
    const sectionHeadings = sectionEls.filter(isHeading);
    const clusterHeading = sectionHeadings.find((x) => {
      const t = normalizeText(x.textContent || '').toLowerCase();
      return t === 'cluster requirements' || t.includes('cluster requirements');
    });

    const clusterMarker =
      clusterHeading ??
      sectionEls.find((x) => {
        const tag = x.tagName.toUpperCase();
        if (tag !== 'P' && tag !== 'DIV' && tag !== 'SECTION') return false;
        const t = normalizeText(x.textContent || '').toLowerCase();
        return t.includes('cluster requirements');
      });

    if (!clusterMarker) continue;
    const table = findNextTable(clusterMarker);
    if (!table) continue;

    deviceTypes.push({
      anchorId: a.id,
      title: normalizeText(h.textContent || a.id),
      clusterTable: parseTable(table),
    });
  }

  deviceTypes.sort((a, b) => a.title.localeCompare(b.title));
  return { title, deviceTypes };
}

function buildDocUrl(version: string): string {
  const v = version.trim();
  return `https://leconiot.com/matter/${encodeURIComponent(v)}/device_library.html`;
}

function buildDocAnchorUrl(version: string, anchorId: string): string {
  return `${buildDocUrl(version)}#${encodeURIComponent(anchorId)}`;
}

const versionOptions = ['1.2', '1.1', '1.0'];

const defaultSettings: MatterCatalogSettings = {
  version: '1.2',
  deviceAnchorId: '',
  filter: '',
};

export default function App() {
  const [settings, setSettings] = useState<MatterCatalogSettings>(defaultSettings);
  const [docTitle, setDocTitle] = useState('Matter Device Library');
  const [deviceTypes, setDeviceTypes] = useState<DeviceTypeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [parsedCount, setParsedCount] = useState(0);

  const saveTimerRef = useRef<number | null>(null);

  const visibleDeviceTypes = useMemo(() => {
    const q = settings.filter.trim().toLowerCase();
    if (!q) return deviceTypes;
    return deviceTypes.filter((d) => d.title.toLowerCase().includes(q) || d.anchorId.toLowerCase().includes(q));
  }, [deviceTypes, settings.filter]);

  const selectedDevice = useMemo(() => {
    if (!settings.deviceAnchorId) return null;
    return deviceTypes.find((d) => d.anchorId === settings.deviceAnchorId) ?? null;
  }, [deviceTypes, settings.deviceAnchorId]);

  const selectedTable = selectedDevice?.clusterTable ?? null;

  const loadSettings = async () => {
    const res = await sdk.storage.get('matter.catalog.settings');
    if (!res.ok) return;
    const raw = res.data as unknown;
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Partial<MatterCatalogSettings>;
    setSettings((s) => ({
      ...s,
      version: typeof r.version === 'string' && r.version ? r.version : s.version,
      deviceAnchorId: typeof r.deviceAnchorId === 'string' ? r.deviceAnchorId : s.deviceAnchorId,
      filter: typeof r.filter === 'string' ? r.filter : s.filter,
    }));
  };

  const saveSettingsSoon = (next: MatterCatalogSettings) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void sdk.storage.set('matter.catalog.settings', next);
    }, 250);
  };

  const refresh = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    setError('');
    if (!silent) setLoading(true);
    try {
      const url = buildDocUrl(settings.version);
      const res = await sdk.http.request<string>({ url, responseType: 'text', timeoutMs: 30000 });
      if (!res.ok) throw new Error(res.error.message);
      const status = Number((res.data as any)?.status ?? 0);
      const html = String((res.data as any)?.data ?? '');
      if (!html) throw new Error('Empty response');
      const parsed = parseDeviceLibraryHtml(html);
      setDocTitle(parsed.title);
      setDeviceTypes(parsed.deviceTypes);
      setParsedCount(parsed.deviceTypes.length);
      if (parsed.deviceTypes.length === 0) {
        throw new Error(status ? `No device types parsed (HTTP ${status})` : 'No device types parsed');
      }

      setLastUpdated(new Date().toISOString());
      if (parsed.deviceTypes.length && !parsed.deviceTypes.some((d) => d.anchorId === settings.deviceAnchorId)) {
        setSettings((s) => ({ ...s, deviceAnchorId: parsed.deviceTypes[0].anchorId }));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      void sdk.log.error('Failed to load Matter Device Library', { message: msg, version: settings.version });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadSettings();
    })();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    saveSettingsSoon(settings);
  }, [settings]);

  useEffect(() => {
    void refresh({ silent: true });
  }, [settings.version]);

  return (
    <div className="app">
      <div className="top">
        <div>
          <div className="title">Matter Catalog</div>
          <div className="sub">
            Source: leconiot.com · Document: {docTitle} · Version: {settings.version} · Parsed: {parsedCount}
            {lastUpdated ? ` · updated: ${lastUpdated}` : ''}
          </div>
        </div>
        <div className="actions">
          <button disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <a className="btnLink" href={buildDocUrl(settings.version)} target="_blank" rel="noreferrer">
            Open Spec
          </a>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="grid">
        <div className="card">
          <div className="cardTitle">Query</div>

          <div className="formRow">
            <div className="label">Matter version</div>
            <div className="rowInput">
              <input
                value={settings.version}
                onChange={(e) => setSettings((s) => ({ ...s, version: e.target.value }))}
                list="matterVersionOptions"
                placeholder="e.g. 1.2"
              />
              <datalist id="matterVersionOptions">
                {versionOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="formRow">
            <div className="label">Device filter</div>
            <input
              value={settings.filter}
              onChange={(e) => setSettings((s) => ({ ...s, filter: e.target.value }))}
              placeholder="Search device type"
            />
          </div>

          <div className="formRow">
            <div className="label">Device type</div>
            <select
              value={settings.deviceAnchorId}
              onChange={(e) => setSettings((s) => ({ ...s, deviceAnchorId: e.target.value }))}
            >
              {visibleDeviceTypes.map((d) => (
                <option key={d.anchorId} value={d.anchorId}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>

          <div className="meta">
            <div className="muted">Matched: {visibleDeviceTypes.length}</div>
            {settings.deviceAnchorId ? (
              <a className="link" href={buildDocAnchorUrl(settings.version, settings.deviceAnchorId)} target="_blank" rel="noreferrer">
                Open selected section
              </a>
            ) : null}
          </div>
        </div>

        <div className="card content">
          <div className="cardTitle">Cluster requirements</div>
          {!selectedDevice ? (
            <div className="empty">Select a device type</div>
          ) : !selectedTable ? (
            <div className="empty">No cluster table found for this device type</div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    {selectedTable.headers.map((h, idx) => (
                      <th key={idx}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedTable.rows.map((r, idx) => (
                    <tr key={idx}>
                      {r.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="foot">
            Notes: Data is extracted from the HTML spec page and may lag behind the newest Matter releases. Use the “Open Spec” link for
            the authoritative source.
          </div>
        </div>
      </div>
    </div>
  );
}
