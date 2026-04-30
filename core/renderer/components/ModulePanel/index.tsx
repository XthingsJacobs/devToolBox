import { useState, type ReactNode } from 'react';
import type { Module } from '../../types';
import styles from './ModulePanel.module.css';
import { useI18n } from '../../i18n';
import { VscChevronRight } from 'react-icons/vsc';

export interface ModuleGroup {
  id: string;
  name: string;
}

interface ModulePanelProps {
  modules: Module[];
  selectedModuleId: string | null;
  onModuleSelect: (moduleId: string) => void;
  footer?: ReactNode;
  itemStatus?: Record<string, 'connected' | 'connecting' | 'disconnected' | 'error'>;
  groups?: ModuleGroup[];
  moduleGroupMap?: Record<string, string | undefined>;
}

export default function ModulePanel({
  modules,
  selectedModuleId,
  onModuleSelect,
  footer,
  itemStatus,
  groups,
  moduleGroupMap,
}: ModulePanelProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleGroup = (gid: string) => setCollapsed((prev) => ({ ...prev, [gid]: !prev[gid] }));

  const renderItem = (mod: Module) => {
    const st = itemStatus?.[mod.id];
    return (
      <div key={mod.id} className={`${styles.item}${mod.id === selectedModuleId ? ` ${styles.active}` : ''}`}>
        <button
          className={styles.itemBtn}
          onClick={() => onModuleSelect(mod.id)}
          aria-current={mod.id === selectedModuleId ? 'true' : undefined}
        >
          {st && <span className={`${styles.statusDot} ${styles[`dot_${st}`]}`} />}
          {mod.name}
        </button>
      </div>
    );
  };

  // No grouping
  if (!groups || groups.length === 0) {
    return (
      <nav className={styles.panel} aria-label={t('dashboard.moduleList')}>
        <div className={styles.list}>{modules.map(renderItem)}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </nav>
    );
  }

  // Grouped mode
  const ungrouped = modules.filter((m) => !moduleGroupMap?.[m.id]);
  const grouped = groups.map((g) => ({
    ...g,
    items: modules.filter((m) => moduleGroupMap?.[m.id] === g.id),
  }));

  return (
    <nav className={styles.panel} aria-label={t('dashboard.moduleList')}>
      <div className={styles.list}>
        {grouped.map((g) => (
          <div key={g.id} className={styles.group}>
            <button className={styles.groupHeader} onClick={() => toggleGroup(g.id)}>
              <span className={`${styles.groupArrow} ${collapsed[g.id] ? '' : styles.groupArrowOpen}`}>
                <VscChevronRight />
              </span>
              <span className={styles.groupName}>{g.name}</span>
              <span className={styles.groupCount}>{g.items.length}</span>
            </button>
            {!collapsed[g.id] && <div className={styles.groupBody}>{g.items.map(renderItem)}</div>}
          </div>
        ))}
        {ungrouped.length > 0 && ungrouped.map(renderItem)}
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </nav>
  );
}
