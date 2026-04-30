export function deriveCity(tz: string): string {
  if (tz === 'UTC') return 'UTC';
  const parts = tz.split('/');
  const last = parts[parts.length - 1] ?? tz;
  return last.replace(/_/g, ' ');
}

export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  if (tz === 'UTC') return true;
  try {
    void new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZones(): string[] {
  const fn = (Intl as unknown as { supportedValuesOf?: (key: 'timeZone') => unknown }).supportedValuesOf;
  if (typeof fn !== 'function') return [];
  try {
    const out = fn('timeZone');
    return Array.isArray(out) ? out.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function getTimeParts(now: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = Number(get('hour')) || 0;
  const minute = Number(get('minute')) || 0;
  const second = Number(get('second')) || 0;
  const time = dtf.format(now);
  return { hour, minute, second, time };
}

export function calcAngles(hour24: number, minute: number, second: number) {
  const h = hour24 % 12;
  const sec = second;
  const min = minute + sec / 60;
  const hr = h + min / 60;
  const secDeg = sec * 6;
  const minDeg = min * 6;
  const hourDeg = hr * 30;
  return { hourDeg, minDeg, secDeg };
}

export function formatDateLine(now: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' });
  return dtf.format(now);
}

export function getDateParts(now: Date, timeZone: string): { day: string; rest: string } {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' });
  const parts = dtf.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday');
  const month = get('month');
  const day = get('day') || '';
  const year = get('year');
  const rest = `${weekday}${weekday ? ', ' : ''}${month}${month ? ' ' : ''}${year}`.trim();
  return { day, rest };
}
