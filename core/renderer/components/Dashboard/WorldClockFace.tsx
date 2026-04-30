import styles from './WorldClocks.module.css';

export default function WorldClockFace({
  angles,
}: {
  angles: { hourDeg: number; minDeg: number; secDeg: number };
}) {
  return (
    <div className={styles.faceWrap}>
      <div className={styles.face}>
        <div className={styles.ticks} aria-hidden="true">
          {Array.from({ length: 60 }).map((_, i) => {
            const isQuarter = i % 15 === 0;
            const isHour = i % 5 === 0;
            const cls = `${styles.tick}${isQuarter ? ` ${styles.tickQuarter}` : isHour ? ` ${styles.tickHour}` : ''}`;
            return (
              <span
                key={i}
                className={cls}
                style={{ transform: `rotate(${i * 6}deg) translateY(-58px) translateX(-50%)` }}
              />
            );
          })}
        </div>
        <div
          className={`${styles.hand} ${styles.hourHand}`}
          style={{ transform: `translate(-50%, -100%) rotate(${angles.hourDeg}deg)` }}
        />
        <div
          className={`${styles.hand} ${styles.minHand}`}
          style={{ transform: `translate(-50%, -100%) rotate(${angles.minDeg}deg)` }}
        />
        <div className={styles.secTail} style={{ transform: `translate(-50%, 0%) rotate(${angles.secDeg}deg)` }} />
        <div
          className={`${styles.hand} ${styles.secHand}`}
          style={{ transform: `translate(-50%, -100%) rotate(${angles.secDeg}deg)` }}
        />
        <div className={styles.centerDot} />
      </div>
    </div>
  );
}

