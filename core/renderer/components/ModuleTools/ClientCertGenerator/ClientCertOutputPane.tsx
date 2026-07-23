import type { LocaleText, OutputTab, TabId } from './ClientCertGenerator.types';
import styles from './ClientCertGenerator.module.css';

export function ClientCertOutputPane({
  tabs,
  activeTab,
  currentOutput,
  onActiveTabChange,
  onCopy,
  onSave,
  mt,
}: {
  tabs: OutputTab[];
  activeTab: TabId;
  currentOutput: string;
  onActiveTabChange: (tab: TabId) => void;
  onCopy: () => void;
  onSave: () => void;
  mt: LocaleText;
}) {
  return (
    <div className={styles.output}>
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => onActiveTabChange(tab.id)}
          >
            {tab.literalLabel ?? mt(tab.labelKey)}
          </button>
        ))}
      </div>
      {currentOutput ? (
        <>
          <div className={styles.outputActions}>
            <button className={styles.actionBtn} onClick={onCopy}>
              {mt('copy')}
            </button>
            <button className={styles.actionBtn} onClick={onSave}>
              {mt('save')}
            </button>
          </div>
          <div className={styles.outputArea}>
            <pre className={styles.outputText}>{currentOutput}</pre>
          </div>
        </>
      ) : (
        <div className={styles.outputArea}>
          <div className={styles.placeholder}>{mt('emptyHint')}</div>
        </div>
      )}
    </div>
  );
}
