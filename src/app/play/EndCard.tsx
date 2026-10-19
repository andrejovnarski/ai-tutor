import Link from "next/link";
import type { Rewards, Summary } from "./playMachine";
import { RewardsStrip } from "./RewardsStrip";
import styles from "./play.module.css";

export function EndCard({ summary, rewards, onPlayAgain }: {
  summary: Pick<Summary, "problems" | "firstTryCorrect">;
  rewards?: Rewards;
  onPlayAgain: () => void;
}) {
  const { problems, firstTryCorrect } = summary;
  const stats = (
    <div className={styles.endStats}>
      <p className={styles.endStat}>
        <span className={styles.endNumber}>{problems}</span> {problems === 1 ? "problem" : "problems"}
      </p>
      <p className={styles.endStat}>
        <span className={styles.endNumber}>{firstTryCorrect}</span> right on the first try
      </p>
    </div>
  );
  return (
    <section className={styles.endCard} data-testid="end-card" aria-labelledby="end-title">
      <h1 id="end-title" className={styles.endTitle}>Great work today!</h1>
      {rewards ? (
        <div className={styles.endBody}>
          {stats}
          <RewardsStrip rewards={rewards} />
        </div>
      ) : stats}
      <div className={styles.endActions}>
        <button type="button" className={styles.endButton} onClick={onPlayAgain}>Play again</button>
        <Link href="/" className={styles.endLink}>Back to kids</Link>
      </div>
    </section>
  );
}
