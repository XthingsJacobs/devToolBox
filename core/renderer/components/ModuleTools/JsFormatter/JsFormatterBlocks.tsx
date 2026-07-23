import { VscChevronUp } from 'react-icons/vsc';
import type { JsTextStats, LocaleText } from './JsFormatter.types';
import styles from './JsFormatter.module.css';

export function StatsBar({ stats, mt }: { stats: JsTextStats; mt: LocaleText }) {
  return (
    <div className={styles.statusBar}>
      <span>
        {mt('chars')}: {stats.length}
      </span>
      <span>
        {mt('lines')}: {stats.lines}
      </span>
    </div>
  );
}

export function ScrollTopButton({
  show,
  onClick,
  label,
}: {
  show: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className={`${styles.scrollTopBtn} ${show ? styles.scrollTopVisible : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      <VscChevronUp />
    </button>
  );
}
