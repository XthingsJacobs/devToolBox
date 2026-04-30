import type { ReactNode } from 'react';
import styles from './TopNav.module.css';

export interface TopNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TopNavProps {
  items: TopNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  rightItems?: TopNavItem[];
  onSelectRight?: (id: string) => void;
}

export default function TopNav({ items, activeId, onSelect, rightItems = [], onSelectRight }: TopNavProps) {
  return (
    <header className={styles.bar}>
      <nav className={styles.group} aria-label="Top navigation">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={`${styles.item}${activeId === it.id ? ` ${styles.active}` : ''}`}
            onClick={() => onSelect(it.id)}
          >
            {it.icon && (
              <span className={styles.icon} aria-hidden="true">
                {it.icon}
              </span>
            )}
            <span className={styles.label}>{it.label}</span>
          </button>
        ))}
      </nav>
      <div className={styles.spacer} />
      {rightItems.length > 0 && (
        <nav className={styles.group} aria-label="Top actions">
          {rightItems.map((it) => (
            <button
              key={it.id}
              type="button"
              className={`${styles.item}${activeId === it.id ? ` ${styles.active}` : ''}`}
              onClick={() => onSelectRight?.(it.id)}
            >
              {it.icon && (
                <span className={styles.icon} aria-hidden="true">
                  {it.icon}
                </span>
              )}
              <span className={styles.label}>{it.label}</span>
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
