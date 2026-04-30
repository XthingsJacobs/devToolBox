import { useMemo } from 'react';
import { HelpModal } from '@@components';
import styles from './WorldClocks.module.css';
import { POPULAR_ZONES } from './WorldClocks.constants';
import { deriveCity } from './WorldClocks.time';

export default function AddTimeZoneModal({
  open,
  title,
  searchPlaceholder,
  customLabel,
  addLabel,
  addedLabel,
  search,
  onSearchChange,
  canAddTyped,
  candidates,
  disabledZones,
  onAdd,
  onClose,
}: {
  open: boolean;
  title: string;
  searchPlaceholder: string;
  customLabel: string;
  addLabel: string;
  addedLabel: string;
  search: string;
  onSearchChange: (v: string) => void;
  canAddTyped: boolean;
  candidates: string[];
  disabledZones: Set<string>;
  onAdd: (tz: string) => void;
  onClose: () => void;
}) {
  const trimmed = search.trim();
  const typedCity = useMemo(() => (trimmed ? deriveCity(trimmed) : ''), [trimmed]);

  if (!open) return null;

  return (
    <HelpModal title={title} size="md" onClose={onClose}>
      <input
        className={styles.modalSearch}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        spellCheck={false}
      />
      <div className={styles.modalList}>
        {canAddTyped ? (
          <button
            type="button"
            className={styles.modalItem}
            onClick={() => {
              onAdd(trimmed);
              onSearchChange('');
              onClose();
            }}
          >
            <div className={styles.modalLeft}>
              <div className={styles.modalTz}>{trimmed}</div>
              <div className={styles.modalCity}>{typedCity || customLabel}</div>
            </div>
            <span className={styles.modalTag}>{addLabel}</span>
          </button>
        ) : null}

        {candidates.map((tz) => {
          const disabled = disabledZones.has(tz);
          const city = POPULAR_ZONES.find((x) => x.tz === tz)?.city ?? deriveCity(tz);
          return (
            <button
              key={tz}
              type="button"
              className={styles.modalItem}
              disabled={disabled}
              onClick={() => {
                onAdd(tz);
                onSearchChange('');
                onClose();
              }}
            >
              <div className={styles.modalLeft}>
                <div className={styles.modalTz}>{tz}</div>
                <div className={styles.modalCity}>{city}</div>
              </div>
              <span className={styles.modalTag}>{disabled ? addedLabel : addLabel}</span>
            </button>
          );
        })}
      </div>
    </HelpModal>
  );
}

