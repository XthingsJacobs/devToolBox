import styles from './SettingsPage.module.css';
import { SettingsCard } from './SettingsCard';

export function AboutSection({ versionText }: { versionText: string }) {
  return (
    <div className={styles.stack}>
      <SettingsCard title="DevToolBox" subtitle="Developer productivity utilities hub">
        <div className={styles.aboutHero}>
          <div className={styles.aboutLogo}>DT</div>
          <div>
            <div className={styles.aboutName}>DevToolBox</div>
            <div className={styles.aboutMeta}>{`Version ${versionText.replace(/^v/, '')}`}</div>
          </div>
        </div>
        <div className={styles.kv}>
          {[
            ['License', 'Apache-2.0'],
            ['Runtime', 'Electron + React'],
            ['Platform', 'macOS / Windows'],
          ].map(([key, value]) => (
            <div key={key} className={styles.kvRow}>
              <span className={styles.kvKey}>{key}</span>
              <span className={styles.kvVal}>{value}</span>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
