import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styles from './GlobalSearch.module.css';
import { getCategories } from '../../data/placeholder';
import type { Module } from '../../types';
import { useI18n } from '../../i18n';
import { VscSearch } from 'react-icons/vsc';

interface GlobalSearchProps {
  onSelect: (categoryId: string, moduleId: string) => void;
  onClose: () => void;
  extraModules?: { module: Module; categoryId: string; categoryName: string }[];
}

export default function GlobalSearch({ onSelect, onClose, extraModules = [] }: GlobalSearchProps) {
  const { locale, t } = useI18n();
  const categories = useMemo(() => getCategories(locale), [locale]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Auto-focus on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allModules = useMemo(() => {
    const result: { module: Module; categoryId: string; categoryName: string }[] = [];
    for (const cat of categories) {
      for (const mod of cat.modules) result.push({ module: mod, categoryId: cat.id, categoryName: cat.name });
    }
    return [...result, ...extraModules];
  }, [categories, extraModules]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return allModules.filter(
      ({ module }) =>
        module.name.toLowerCase().includes(term) ||
        module.id.toLowerCase().includes(term) ||
        module.description.toLowerCase().includes(term),
    );
  }, [searchTerm, allModules]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchResults]);

  const selectResult = useCallback(
    (index: number) => {
      const item = searchResults[index];
      if (item) {
        onSelect(item.categoryId, item.module.id);
        onClose();
      }
    },
    [searchResults, onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (!searchResults.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev < searchResults.length - 1 ? prev + 1 : 0;
          listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev > 0 ? prev - 1 : searchResults.length - 1;
          listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectResult(activeIndex);
      }
    },
    [searchResults, activeIndex, selectResult, onClose],
  );

  // Close when clicking the overlay
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.container}>
        <div className={styles.inputWrap}>
          <span className={styles.icon}>
            <VscSearch />
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder={t('dashboard.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={t('dashboard.searchLabel')}
          />
          <span className={styles.shortcut}>ESC</span>
        </div>
        {searchResults.length > 0 ? (
          <ul className={styles.results} ref={listRef} role="listbox">
            {searchResults.map(({ module, categoryName }, index) => (
              <li key={module.id} role="option" aria-selected={index === activeIndex}>
                <button
                  className={`${styles.resultItem}${index === activeIndex ? ` ${styles.resultActive}` : ''}`}
                  onClick={() => selectResult(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className={styles.resultIcon}>{module.icon || '🔧'}</span>
                  <span className={styles.resultText}>
                    <span className={styles.resultName}>{module.name}</span>
                    <span className={styles.resultDesc}>
                      {categoryName} · {module.description}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : searchTerm.trim() ? (
          <p className={styles.empty}>{t('dashboard.searchPlaceholder')}</p>
        ) : null}
      </div>
    </div>
  );
}
