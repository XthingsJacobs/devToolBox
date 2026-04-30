import { useMemo } from 'react';
import styles from './WorldClocks.module.css';
import { useI18n } from '../../i18n';
import { VscAdd } from 'react-icons/vsc';
import AddTimeZoneModal from './AddTimeZoneModal';
import WorldClockCard from './WorldClockCard';
import { useWorldClocks } from './useWorldClocks';

export default function WorldClocks({ now }: { now: Date }) {
  const { t } = useI18n();
  const wc = useWorldClocks();
  const disabledSet = useMemo(() => new Set(wc.displayedZones), [wc.displayedZones]);

  return (
    <section className={styles.wrap} aria-label={t('dashboard.worldClocks')}>
      <div className={styles.header}>
        <h3 className={styles.title}>{t('dashboard.worldClocks')}</h3>
        <div className={styles.headerRight}>
          <button type="button" className={styles.modeBtn} onClick={wc.openAdd}>
            <VscAdd />
            {t('dashboard.clockAdd')}
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {wc.displayedZones.map((tz, idx) => {
          const isPinned = idx === 0;
          return (
            <WorldClockCard
              key={tz}
              tz={tz}
              now={now}
              isPinned={isPinned}
              pinnedLabel={t('dashboard.clockLocal')}
              onRemove={wc.removeZone}
              removeLabel={t('dashboard.clockRemove')}
            />
          );
        })}
      </div>

      {!wc.displayedZones.length ? <div className={styles.hint}>{t('dashboard.clockEmpty')}</div> : null}

      <AddTimeZoneModal
        open={wc.showAdd}
        title={t('dashboard.clockAddTitle')}
        searchPlaceholder={t('dashboard.clockSearchPlaceholder')}
        customLabel={t('dashboard.clockCustomZone')}
        addLabel={t('dashboard.clockAdd')}
        addedLabel={t('dashboard.clockAdded')}
        search={wc.search}
        onSearchChange={wc.setSearch}
        canAddTyped={wc.canAddTyped}
        candidates={wc.candidates}
        disabledZones={disabledSet}
        onAdd={wc.addZone}
        onClose={() => {
          wc.setSearch('');
          wc.closeAdd();
        }}
      />
    </section>
  );
}
