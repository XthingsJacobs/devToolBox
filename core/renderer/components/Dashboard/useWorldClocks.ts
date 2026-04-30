import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_ZONES, PRESET_ZONES, STORAGE_KEY } from './WorldClocks.constants';
import { getLocalTimeZone, isValidTimeZone, resolveTimeZones } from './WorldClocks.time';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function defaultExtraZones(localTz: string): string[] {
  return PRESET_ZONES.map((z) => z.tz).filter((tz) => tz !== localTz).slice(0, 4);
}

export function useWorldClocks() {
  const localTz = useMemo(() => getLocalTimeZone(), []);
  const [zones, setZones] = useState<string[]>(() => defaultExtraZones(localTz));
  const displayedZones = useMemo(() => [localTz, ...zones], [localTz, zones]);
  const didInitRef = useRef(false);

  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [allZones, setAllZones] = useState<string[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = safeParseJson(raw);
      if (isRecord(parsed)) {
        const z = parsed.zones;
        if (Array.isArray(z) && z.every((x) => typeof x === 'string'))
          setZones(z.filter((tz) => tz !== localTz).slice(0, MAX_ZONES));
      }
    }
  }, [localTz]);

  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ zones }));
  }, [zones]);

  useEffect(() => {
    if (!showAdd) return;
    if (allZones.length) return;
    const list = resolveTimeZones();
    if (list.length) setAllZones(list);
  }, [allZones.length, showAdd]);

  const addZone = useCallback(
    (tzRaw: string) => {
      const tz = tzRaw.trim();
      if (!tz) return;
      if (displayedZones.includes(tz)) return;
      if (!isValidTimeZone(tz)) return;
      setZones((prev) => {
        const next = [...prev, tz].slice(0, MAX_ZONES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ zones: next }));
        return next;
      });
    },
    [displayedZones],
  );

  const removeZone = useCallback((tz: string) => {
    setZones((prev) => {
      const next = prev.filter((z) => z !== tz);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ zones: next }));
      return next;
    });
  }, []);

  const preset = useMemo(() => PRESET_ZONES.map((z) => z.tz), []);

  const candidates = useMemo(() => {
    const merged = Array.from(new Set([...preset, ...allZones]));
    const q = search.trim().toLowerCase();
    if (!q) return preset;
    return merged.filter((z) => z.toLowerCase().includes(q)).slice(0, 300);
  }, [allZones, preset, search]);

  const canAddTyped = useMemo(() => {
    const tz = search.trim();
    if (!tz) return false;
    if (displayedZones.includes(tz)) return false;
    return isValidTimeZone(tz);
  }, [displayedZones, search]);

  const openAdd = useCallback(() => setShowAdd(true), []);
  const closeAdd = useCallback(() => setShowAdd(false), []);

  return {
    localTz,
    displayedZones,
    addZone,
    removeZone,
    showAdd,
    openAdd,
    closeAdd,
    search,
    setSearch,
    candidates,
    canAddTyped,
  };
}
