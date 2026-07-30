import type { ComponentType } from 'react';
import { VscColorMode, VscFolderOpened, VscGlobe, VscInfo, VscPulse } from 'react-icons/vsc';
import { ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL } from '../../marketplace/registry';
import styles from './SettingsPage.module.css';
import { SETTINGS_GROUPS, type SectionId } from './SettingsPage.model';

export type SettingsNavItem = {
  id: SectionId;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  group: (typeof SETTINGS_GROUPS)[number];
  devOnly?: boolean;
};

export const SETTINGS_NAV: SettingsNavItem[] = [
  { id: 'appearance', label: 'Appearance', Icon: VscColorMode, group: 'App' },
  { id: 'language', label: 'Language', Icon: VscGlobe, group: 'App' },
  { id: 'data', label: 'Marketplace', Icon: VscFolderOpened, group: 'System', devOnly: true },
  { id: 'diagnostics', label: 'Diagnostics', Icon: VscPulse, group: 'System' },
  { id: 'about', label: 'About', Icon: VscInfo, group: 'About' },
];

export function getVisibleSettingsNav(): SettingsNavItem[] {
  return SETTINGS_NAV.filter((item) => !item.devOnly || ALLOW_CUSTOM_MARKETPLACE_REGISTRY_URL);
}

export function SettingsNavigation({
  versionText,
  visibleNav,
  active,
  onSelect,
}: {
  versionText: string;
  visibleNav: SettingsNavItem[];
  active: SectionId;
  onSelect: (section: SectionId) => void;
}) {
  return (
    <aside className={styles.nav}>
      <div className={styles.navHeader}>
        <div className={styles.navTitle}>Settings</div>
        <div className={styles.navSub}>{versionText}</div>
      </div>

      {SETTINGS_GROUPS.map((group) => {
        const items = visibleNav.filter((item) => item.group === group);
        if (!items.length) return null;

        return (
          <div key={group} className={styles.navGroup}>
            <div className={styles.navGroupTitle}>{group}</div>
            <div className={styles.navList}>
              {items.map((item) => {
                const isActive = item.id === active;
                const Icon = item.Icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.navItem}
                    data-active={isActive ? '1' : '0'}
                    onClick={() => onSelect(item.id)}
                  >
                    {isActive && <span className={styles.navIndicator} />}
                    <Icon className={styles.navIcon} />
                    <span className={styles.navLabel}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
