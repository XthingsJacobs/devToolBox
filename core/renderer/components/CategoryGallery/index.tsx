import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './CategoryGallery.module.css';
import type { Module } from '../../types';
import { VscSearch } from 'react-icons/vsc';
import { useI18n } from '../../i18n';
import { loadModuleUsage, scoreUsage, subscribeModuleUsageUpdated, type ModuleUsageEntry } from '../../data/moduleUsage';
import ToolCard from '../ToolCard';

function sectionKey(name: string): string {
  const s = String(name ?? '').trim();
  if (!s) return '#';
  const c = s[0]?.toUpperCase() ?? '#';
  if (c >= 'A' && c <= 'Z') return c;
  return '#';
}

function cmpModuleName(a: Module, b: Module): number {
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { sensitivity: 'base' });
}

export default function CategoryGallery({
  modules,
  categoryId,
  onSelect,
}: {
  modules: Module[];
  categoryId?: string;
  onSelect: (moduleId: string) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [letter, setLetter] = useState('');
  const [usageVersion, setUsageVersion] = useState(0);

  const indexKeys = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 26; i++) out.push(String.fromCharCode(65 + i));
    out.push('#');
    return out;
  }, []);

  const baseFiltered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const list = modules.slice().sort(cmpModuleName);
    if (!qq) return list;
    return list.filter((m) => {
      const n = String(m.name ?? '').toLowerCase();
      const d = String(m.description ?? '').toLowerCase();
      return n.includes(qq) || d.includes(qq);
    });
  }, [modules, q]);

  const availableKeys = useMemo(() => new Set(baseFiltered.map((m) => sectionKey(m.name))), [baseFiltered]);
  const filtered = useMemo(() => {
    if (!letter) return baseFiltered;
    return baseFiltered.filter((m) => sectionKey(m.name) === letter);
  }, [baseFiltered, letter]);

  useEffect(() => {
    const unsub = subscribeModuleUsageUpdated(() => setUsageVersion((v) => v + 1));
    return unsub;
  }, []);

  const frequent = useMemo(() => {
    void usageVersion;
    if (!categoryId) return [];
    const index = new Map(modules.map((m) => [m.id, m]));
    const list = loadModuleUsage()
      .filter((u) => u.categoryId === categoryId)
      .map((u) => ({ u, m: index.get(u.moduleId) }))
      .filter((x): x is { u: ModuleUsageEntry; m: Module } => Boolean(x.m))
      .sort((a, b) => scoreUsage(b.u) - scoreUsage(a.u))
      .map((x) => x.m);
    return list.slice(0, 8);
  }, [categoryId, modules, usageVersion]);

  useEffect(() => {
    if (letter && !availableKeys.has(letter)) setLetter('');
  }, [availableKeys, letter]);

  return (
    <div className={styles.wrap}>
      <div className={styles.mainCol}>
        <div className={styles.header}>
          <div className={styles.filterRow}>
            <div className={styles.searchWrap} aria-label={t('dashboard.searchLabel')}>
              <span className={styles.searchIcon}>
                <VscSearch />
              </span>
              <input
                className={styles.searchInput}
                value={q}
                placeholder={t('dashboard.searchPlaceholder')}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className={styles.letterBar}>
              {indexKeys.map((k) => {
                const disabled = !availableKeys.has(k);
                const active = letter === k;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`${styles.letterBtn}${active ? ` ${styles.letterBtnActive}` : ''}${
                      disabled ? ` ${styles.letterBtnDisabled}` : ''
                    }`}
                    onClick={() => {
                      if (disabled) return;
                      setLetter((prev) => (prev === k ? '' : k));
                      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.body}>
          <div ref={scrollRef} className={styles.scroll}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>No tools</div>
            ) : (
              <div className={styles.grid}>
                {filtered.map((m) => (
                  <ToolCard
                    key={m.id}
                    icon={m.icon}
                    name={m.name}
                    meta={m.description || ''}
                    onClick={() => onSelect(m.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className={styles.rightCol} aria-label={t('dashboard.frequentTools')}>
        <div className={styles.quickTitle}>{t('dashboard.frequentTools')}</div>
        {frequent.length > 0 ? (
          <div className={styles.sideList}>
            {frequent.map((m) => (
              <ToolCard key={m.id} icon={m.icon} name={m.name} meta={m.description || ''} onClick={() => onSelect(m.id)} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>No tools</div>
        )}
      </aside>
    </div>
  );
}
