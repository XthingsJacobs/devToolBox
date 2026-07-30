import { useState } from 'react';
import { VscSparkle } from 'react-icons/vsc';
import styles from './DashboardPage.module.css';
import type { Category } from '../../types';
import { DashboardQuickNav } from './DashboardQuickNav';
import { DashboardSearch } from './DashboardSearch';
import { DashboardWidgets } from './DashboardWidgets';
import { useDashboardData } from './useDashboardData';
import { useDashboardGridLayout } from './useDashboardGridLayout';
import { useDashboardTools } from './useDashboardTools';

export default function DashboardPage({
  categories,
  onOpenTool,
  onCategorySelect,
}: {
  categories: Category[];
  onOpenTool: (categoryId: string, moduleId: string) => void;
  onCategorySelect: (categoryId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const { now, appInfo, networkInfo } = useDashboardData();
  const { searchResults, frequent } = useDashboardTools(categories, query);
  const grid = useDashboardGridLayout();

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.headerTopRow}>
            <div className={styles.headerMeta}>
              <div className={styles.headerIcon}>
                <VscSparkle size={15} />
              </div>
              <span className={styles.headerKicker}>Dashboard</span>
            </div>

            <DashboardSearch
              query={query}
              setQuery={setQuery}
              searchResults={searchResults}
              onOpenTool={onOpenTool}
            />
          </div>

          <h1 className={styles.headerTitle}>Welcome back 👋</h1>
          <p className={styles.headerSub}>
            {now.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <DashboardQuickNav categories={categories} onCategorySelect={onCategorySelect} />

        <DashboardWidgets
          grid={grid}
          frequent={frequent}
          appInfo={appInfo}
          networkInfo={networkInfo}
          now={now}
          onOpenTool={onOpenTool}
          onCategorySelect={onCategorySelect}
        />
      </div>
    </div>
  );
}
