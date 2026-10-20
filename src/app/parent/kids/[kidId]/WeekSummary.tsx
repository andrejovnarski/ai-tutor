import type { KidWeek } from "@/server/report/build";
import { Cubes } from "../../ui/Cubes";
import styles from "../../ui/grownup.module.css";

export function WeekSummary({
  nickname,
  week,
  playedDays,
}: {
  nickname: string;
  week: KidWeek;
  playedDays: string[];
}) {
  if (week.sessions === 0) {
    return (
      <p className={styles.lede}>
        {`${nickname} hasn't played this week. Hand over the tablet and tap ${nickname} to start.`}
      </p>
    );
  }
  const sessions = `${week.sessions} ${week.sessions === 1 ? "session" : "sessions"}`;
  const minutes = week.minutes === 0 ? "under a minute" : `${week.minutes} ${week.minutes === 1 ? "minute" : "minutes"}`;
  const tricky = week.stuck.length ? ` Tricky part: ${week.stuck.join(", ")}.` : "";
  return (
    <div className={styles.weekBlock}>
      <p className={styles.lede}>{`${sessions}, ${minutes}`}</p>
      <p className={styles.weekRow}>
        <Cubes
          filled={playedDays.length}
          total={7}
          color="blue"
          label={`Played ${playedDays.length} of the last 7 days`}
        />
      </p>
      {week.mastered.length > 0 && (
        <p className={styles.weekRow}>
          <span className={styles.block}>{`Learned: ${week.mastered.join(", ")}`}</span>
          <Cubes
            filled={week.mastered.length}
            total={week.mastered.length}
            color="green"
            max={10}
            label={`${week.mastered.length} ${week.mastered.length === 1 ? "skill" : "skills"} mastered`}
          />
        </p>
      )}
      <p className={styles.lede}>
        {week.currentSkill === null ? (
          "Everything so far is mastered."
        ) : (
          <>
            {"Working on "}
            <b>{week.currentSkill}</b>
            {`.${tricky}`}
          </>
        )}
      </p>
    </div>
  );
}
