import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { VscSearch } from 'react-icons/vsc';
import styles from './DashboardPage.module.css';
import type { FlatTool } from './DashboardPage.model';

export function DashboardSearch({
  query,
  setQuery,
  searchResults,
  onOpenTool,
}: {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  searchResults: FlatTool[];
  onOpenTool: (categoryId: string, moduleId: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchResults.length === 0) {
      setActiveSearchIndex(0);
      return;
    }
    setActiveSearchIndex((index) => Math.max(0, Math.min(searchResults.length - 1, index)));
  }, [searchResults.length]);

  useEffect(() => {
    const current = searchResults[activeSearchIndex];
    if (!current) return;
    searchItemRefs.current[current.module.id]?.scrollIntoView({ block: 'nearest' });
  }, [activeSearchIndex, searchResults]);

  const openTool = (tool: FlatTool) => {
    setQuery('');
    setFocused(false);
    searchInputRef.current?.blur();
    onOpenTool(tool.categoryId, tool.module.id);
  };

  return (
    <div className={styles.searchWrap} data-focused={focused ? '1' : '0'}>
      <div className={styles.searchBox} data-focused={focused ? '1' : '0'}>
        <VscSearch className={styles.searchIcon} />
        <input
          ref={searchInputRef}
          className={styles.searchInput}
          value={query}
          placeholder="Search tools…"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveSearchIndex(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (searchResults.length === 0) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveSearchIndex((index) => (index + 1) % searchResults.length);
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveSearchIndex((index) => (index - 1 + searchResults.length) % searchResults.length);
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              const current = searchResults[activeSearchIndex];
              if (current) openTool(current);
              return;
            }
            if (event.key === 'Escape') {
              if (!query) return;
              event.preventDefault();
              setQuery('');
              setActiveSearchIndex(0);
            }
          }}
        />
        {query ? (
          <button className={styles.clearBtn} type="button" onClick={() => setQuery('')}>
            Clear
          </button>
        ) : (
          <kbd className={styles.kbd}>⌘ K</kbd>
        )}
      </div>

      {searchResults.length > 0 && (
        <div
          className={`${styles.searchDropdown} fade-in`}
          role="listbox"
          aria-activedescendant={`dash-search-${searchResults[activeSearchIndex]?.module.id ?? ''}`}
        >
          <div className={styles.searchDropdownTitle}>
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </div>
          {searchResults.map((tool, index) => (
            <button
              key={tool.module.id}
              type="button"
              id={`dash-search-${tool.module.id}`}
              role="option"
              aria-selected={index === activeSearchIndex}
              className={`${styles.searchItem}${index === activeSearchIndex ? ` ${styles.searchItemActive}` : ''}`}
              ref={(element) => {
                searchItemRefs.current[tool.module.id] = element;
              }}
              onClick={() => openTool(tool)}
              onMouseEnter={() => setActiveSearchIndex(index)}
            >
              <div
                className={styles.searchItemIcon}
                style={{
                  color: tool.categoryColor,
                  background: `${tool.categoryColor}18`,
                  borderColor: `${tool.categoryColor}30`,
                }}
              >
                {tool.module.icon}
              </div>
              <div className={styles.searchItemText}>
                <div className={styles.searchItemName}>{tool.module.name}</div>
                <div className={styles.searchItemDesc}>{tool.module.description}</div>
              </div>
              <span
                className={styles.searchItemPill}
                style={{
                  color: tool.categoryColor,
                  background: `${tool.categoryColor}15`,
                  borderColor: `${tool.categoryColor}25`,
                }}
              >
                {tool.categoryName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
