import type { Dispatch, SetStateAction } from 'react';
import { VscChevronDown, VscFolderOpened, VscSearch } from 'react-icons/vsc';
import styles from './ModulesPage.module.css';
import type { TabId } from './ModulesPage.model';

export function ModuleFilters({
  activeTab,
  setActiveTab,
  installedCount,
  marketplaceCount,
  localOnly,
  setLocalOnly,
  categories,
  filterCat,
  setFilterCat,
  query,
  setQuery,
}: {
  activeTab: TabId;
  setActiveTab: Dispatch<SetStateAction<TabId>>;
  installedCount: number;
  marketplaceCount: number;
  localOnly: boolean;
  setLocalOnly: Dispatch<SetStateAction<boolean>>;
  categories: string[];
  filterCat: string;
  setFilterCat: Dispatch<SetStateAction<string>>;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
}) {
  return (
    <div className={styles.topbar}>
      <div className={styles.tabs} role="tablist" aria-label="Module tabs">
        {(['installed', 'marketplace'] as const).map((tab) => {
          const active = activeTab === tab;
          const count = tab === 'installed' ? installedCount : marketplaceCount;
          return (
            <button
              key={tab}
              type="button"
              className={styles.tab}
              data-active={active ? '1' : '0'}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'installed' ? 'Installed' : 'Marketplace'}
              <span className={styles.tabCount} data-active={active ? '1' : '0'}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.spacer} />

      <div className={styles.filters}>
        {activeTab === 'marketplace' ? (
          <button
            type="button"
            className={styles.localToggle}
            data-active={localOnly ? '1' : '0'}
            onClick={() => setLocalOnly((value) => !value)}
          >
            <VscFolderOpened />
            Local
          </button>
        ) : null}

        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={filterCat}
            onChange={(event) => setFilterCat(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <VscChevronDown className={styles.selectIcon} />
        </div>

        <div className={styles.search}>
          <VscSearch className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search modules…"
          />
        </div>
      </div>
    </div>
  );
}
