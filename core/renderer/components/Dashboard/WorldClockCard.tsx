import styles from './WorldClocks.module.css';
import { VscChromeClose } from 'react-icons/vsc';
import { POPULAR_ZONES } from './WorldClocks.constants';
import { calcAngles, deriveCity, formatDateLine, getDateParts, getTimeParts } from './WorldClocks.time';
import WorldClockFace from './WorldClockFace';

export default function WorldClockCard({
  tz,
  now,
  isPinned,
  pinnedLabel,
  onRemove,
  removeLabel,
}: {
  tz: string;
  now: Date;
  isPinned: boolean;
  pinnedLabel: string;
  onRemove: (tz: string) => void;
  removeLabel: string;
}) {
  const city = isPinned ? pinnedLabel : POPULAR_ZONES.find((x) => x.tz === tz)?.city ?? deriveCity(tz);
  const time = getTimeParts(now, tz);
  const angles = calcAngles(time.hour, time.minute, time.second);
  const dateLine = formatDateLine(now, tz);
  const dateParts = getDateParts(now, tz);

  return (
    <div className={styles.clockCard}>
      <div className={styles.clockHead}>
        <div className={styles.meta}>
          <div className={styles.city} title={city}>
            {city}
          </div>
          <div className={styles.tz} title={tz}>
            {tz}
          </div>
        </div>
        {!isPinned ? (
          <button type="button" className={styles.removeBtn} onClick={() => onRemove(tz)} aria-label={removeLabel}>
            <VscChromeClose />
          </button>
        ) : null}
      </div>

      <WorldClockFace angles={angles} />

      <div className={styles.analogFooter}>
        <div className={styles.digitalTime}>{time.time}</div>
      </div>

      <div className={styles.dateRow} title={dateLine}>
        <span className={styles.dayBadge}>{dateParts.day}</span>
        <span className={styles.dateText}>{dateParts.rest}</span>
      </div>
    </div>
  );
}

