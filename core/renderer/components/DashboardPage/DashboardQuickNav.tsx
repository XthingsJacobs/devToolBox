import styles from './DashboardPage.module.css';
import type { Category } from '../../types';
import { dashboardCategoryColor } from './DashboardPage.model';

export function DashboardQuickNav({
  categories,
  onCategorySelect,
}: {
  categories: Category[];
  onCategorySelect: (categoryId: string) => void;
}) {
  return (
    <div className={`${styles.quickNav} no-scrollbar`}>
      {categories.map((category) => {
        const color = dashboardCategoryColor(category.id);
        return (
          <button
            key={category.id}
            type="button"
            className={styles.quickNavItem}
            style={{ background: `${color}12`, borderColor: `${color}25`, color }}
            onClick={() => onCategorySelect(category.id)}
          >
            <span className={styles.quickNavIcon} style={{ color }}>
              {category.icon}
            </span>
            <span className={styles.quickNavLabel}>{category.name}</span>
            <span className={styles.quickNavCount}>{category.modules.length}</span>
          </button>
        );
      })}
    </div>
  );
}
