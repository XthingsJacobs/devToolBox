import type { Category } from '../../types';
import styles from './CategorySidebar.module.css';
import { useI18n } from '../../i18n';

interface CategorySidebarProps {
  categories: Category[];
  selectedCategoryId: string;
  onCategorySelect: (categoryId: string) => void;
}

export default function CategorySidebar({
  categories,
  selectedCategoryId,
  onCategorySelect,
}: CategorySidebarProps) {
  const { t } = useI18n();
  return (
    <nav className={styles.sidebar} aria-label={t('dashboard.categoryNav')}>
      {categories.map((cat) => (
        <button
          key={cat.id}
          className={`${styles.item}${cat.id === selectedCategoryId ? ` ${styles.active}` : ''}`}
          onClick={() => onCategorySelect(cat.id)}
          aria-current={cat.id === selectedCategoryId ? 'true' : undefined}
        >
          <span className={styles.icon} aria-hidden="true">
            {cat.icon}
          </span>
          <span className={styles.label}>{cat.name}</span>
        </button>
      ))}
    </nav>
  );
}
