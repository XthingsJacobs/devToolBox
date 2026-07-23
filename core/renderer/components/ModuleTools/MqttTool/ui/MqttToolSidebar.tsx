import type { MqttConfig, MqttGroup } from '../mqttTypes';
import type { ConnStatus } from './MqttWorkspace.types';
import styles from './MqttTool.module.css';
import { VscAdd, VscFolder } from 'react-icons/vsc';
import { t } from './i18n';

interface MqttToolSidebarProps {
  ungrouped: MqttConfig[];
  groups: MqttGroup[];
  grouped: Record<string, MqttConfig[]>;
  activeId: string | null;
  openGroups: Record<string, boolean>;
  statuses: Record<string, ConnStatus>;
  onAddGroup: () => void;
  onAddConfig: () => void;
  onSelectConfig: (id: string) => void;
  onToggleGroup: (id: string) => void;
}

export default function MqttToolSidebar({
  ungrouped,
  groups,
  grouped,
  activeId,
  openGroups,
  statuses,
  onAddGroup,
  onAddConfig,
  onSelectConfig,
  onToggleGroup,
}: MqttToolSidebarProps) {
  return (
    <div className={styles.side}>
      <div className={styles.sideHeader}>
        <div className={styles.sideTitle}>MQTT</div>
        <div className={styles.sideActions}>
          <button className={styles.sideBtn} onClick={onAddGroup} title={t('addGroup')}>
            <VscFolder />
          </button>
          <button className={styles.sideBtn} onClick={onAddConfig} title={t('addClient')}>
            <VscAdd />
          </button>
        </div>
      </div>

      <div className={styles.sideList}>
        {ungrouped.map((config) => (
          <ConnectionRow
            key={config.id}
            config={config}
            status={statuses[config.id] ?? 'disconnected'}
            active={activeId === config.id}
            onSelect={onSelectConfig}
          />
        ))}
        {groups.map((group) => (
          <ConnectionGroup
            key={group.id}
            group={group}
            configs={grouped[group.id] ?? []}
            activeId={activeId}
            open={openGroups[group.id] ?? true}
            statuses={statuses}
            onSelectConfig={onSelectConfig}
            onToggleGroup={onToggleGroup}
          />
        ))}
      </div>
    </div>
  );
}

function ConnectionGroup({
  group,
  configs,
  activeId,
  open,
  statuses,
  onSelectConfig,
  onToggleGroup,
}: {
  group: MqttGroup;
  configs: MqttConfig[];
  activeId: string | null;
  open: boolean;
  statuses: Record<string, ConnStatus>;
  onSelectConfig: (id: string) => void;
  onToggleGroup: (id: string) => void;
}) {
  return (
    <div className={styles.groupRow}>
      <button className={styles.groupHeader} onClick={() => onToggleGroup(group.id)}>
        <div className={styles.groupLeft}>
          <span className={`${styles.groupArrow} ${open ? styles.groupArrowOpen : ''}`}>▶</span>
          <span className={styles.groupName}>{group.name}</span>
          <span className={styles.groupCount}>({configs.length})</span>
        </div>
      </button>
      {open &&
        configs.map((config) => (
          <ConnectionRow
            key={config.id}
            config={config}
            status={statuses[config.id] ?? 'disconnected'}
            active={activeId === config.id}
            onSelect={onSelectConfig}
          />
        ))}
    </div>
  );
}

function ConnectionRow({
  config,
  status,
  active,
  onSelect,
}: {
  config: MqttConfig;
  status: ConnStatus;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className={`${styles.connRow} ${active ? styles.connRowActive : ''}`}
      onClick={() => onSelect(config.id)}
    >
      <span className={`${styles.statusDot} ${styles[`dot_${status}`]}`} />
      <div className={styles.connName}>{config.name || '(unnamed)'}</div>
      <div className={styles.connDesc}>
        {config.protocol}
        {config.host}:{config.port}
      </div>
    </div>
  );
}
