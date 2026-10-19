import type { Progress } from "@/domain/rewards/progress";
import { Rod } from "./rewards/Rod";
import { WeekDots } from "./rewards/WeekDots";
import styles from "./picker.module.css";

/** The level, the rod and this week's days, small, for a picker card. */
export function MiniRewards({ progress }: { progress: Progress }) {
  return (
    <span className={styles.mini}>
      <span className={styles.level}>Lv {progress.level}</span>
      <span className={styles.miniArt}>
        <Rod filled={progress.cubesInRod} size="s" />
        <WeekDots days={progress.week.days} size="s" />
      </span>
    </span>
  );
}
