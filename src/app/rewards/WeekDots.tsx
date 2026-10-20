import styles from "./rewards.module.css";

/** This week's seven days, Sunday first; a played day is a yellow counter. */
export function WeekDots({ days, size }: { days: boolean[]; size: "s" | "m" }) {
  const week = Array.from({ length: 7 }, (_, i) => days[i] === true);
  const played = week.filter(Boolean).length;
  return (
    <span className={`${styles.week} ${size === "s" ? styles.weekS : styles.weekM}`} role="img"
      aria-label={`Played ${played} ${played === 1 ? "day" : "days"} this week`}>
      {week.map((p, i) => (
        <span key={i} className={`${styles.day}${p ? ` ${styles.dayPlayed}` : ""}`} data-day={p ? "played" : "not-yet"} />
      ))}
    </span>
  );
}
