function splitParts(v: string): { main: number[]; pre: string[] } {
  const raw = String(v ?? '').trim();
  const [mainRaw, preRaw] = raw.split('-', 2);
  const main = mainRaw
    .split('.')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    });
  const pre = preRaw
    ? preRaw
        .split('.')
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  return { main, pre };
}

export function compareVersions(a: string, b: string): number {
  const aa = splitParts(a);
  const bb = splitParts(b);
  const max = Math.max(aa.main.length, bb.main.length);
  for (let i = 0; i < max; i += 1) {
    const av = aa.main[i] ?? 0;
    const bv = bb.main[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  const aPre = aa.pre;
  const bPre = bb.pre;
  if (aPre.length === 0 && bPre.length === 0) return 0;
  if (aPre.length === 0) return 1;
  if (bPre.length === 0) return -1;

  const maxPre = Math.max(aPre.length, bPre.length);
  for (let i = 0; i < maxPre; i += 1) {
    const ap = aPre[i];
    const bp = bPre[i];
    if (ap === undefined) return -1;
    if (bp === undefined) return 1;
    const an = Number(ap);
    const bn = Number(bp);
    const aIsNum = Number.isFinite(an) && String(an) === ap;
    const bIsNum = Number.isFinite(bn) && String(bn) === bp;
    if (aIsNum && bIsNum) {
      if (an > bn) return 1;
      if (an < bn) return -1;
      continue;
    }
    if (aIsNum && !bIsNum) return -1;
    if (!aIsNum && bIsNum) return 1;
    if (ap > bp) return 1;
    if (ap < bp) return -1;
  }
  return 0;
}

export function isNewerVersion(remoteVersion: string, localVersion: string): boolean {
  return compareVersions(remoteVersion, localVersion) > 0;
}

