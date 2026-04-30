import type { ReactNode } from 'react';
import styles from './ToolCard.module.css';

export default function ToolCard({
  icon,
  name,
  meta,
  onClick,
}: {
  icon?: ReactNode;
  name: string;
  meta?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <span className={styles.icon}>{icon ?? '🔧'}</span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{meta ?? ''}</span>
      </span>
    </button>
  );
}

