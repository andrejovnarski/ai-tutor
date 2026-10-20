import type { Progress } from "@/domain/rewards/progress";
import { IslandMap } from "./rewards/IslandMap";
import styles from "./picker.module.css";

/** Still map art stays quiet so the card's accessible name starts with the kid's name. */
export function MiniRewards({ progress }: { progress: Progress }) {
  return (
    <span className={styles.mini}>
      <span className={styles.miniArt} aria-hidden="true">
        <IslandMap map={progress.map} size="mini" />
      </span>
      <span className={styles.level}>
        <span className={styles.levelPart}>Level {progress.level}</span>
        <span aria-hidden="true"> · </span>
        <span className={styles.levelPart}><span role="img" aria-label="shells">🐚</span> {progress.cubesInRod} of 10</span>
      </span>
    </span>
  );
}
