import type { EndRewards } from "@/domain/rewards/progress";
import { WEEK_GOAL_DAYS } from "@/domain/rewards/rules";
import { stickerById } from "@/domain/rewards/stickers";
import { Rod } from "../rewards/Rod";
import { StickerArt } from "../rewards/StickerArt";
import { WeekDots } from "../rewards/WeekDots";
import styles from "../rewards/rewards.module.css";

const MAX_STICKERS = 3;

function weekLine({ played, goalMet }: EndRewards["week"]): string {
  if (goalMet) return "Week goal done!";
  const left = Math.max(1, WEEK_GOAL_DAYS - played);
  return `${left} more ${left === 1 ? "day" : "days"} for your week goal`;
}

/** What the session earned, under the end card's counts: XP and the rod filling, a new level, new stickers, the week. */
export function RewardsStrip({ rewards }: { rewards: EndRewards }) {
  const { xp, levelBefore, levelAfter, cubesBefore, cubesAfter, newStickers, week } = rewards;
  const levelUp = levelAfter > levelBefore;
  // An id the catalogue doesn't know is skipped, never drawn blank.
  const stickers = newStickers.flatMap((id) => stickerById(id) ?? []);
  const shown = stickers.slice(0, MAX_STICKERS);
  const more = stickers.length - shown.length;
  return (
    <div className={styles.strip} data-testid="rewards-strip">
      <div className={styles.gain}>
        <p className={styles.xp}>+{xp}</p>
        <div className={styles.rods}>
          {levelUp ? <Rod filled={10} size="m" /> : null}
          <Rod filled={cubesAfter} animateFrom={levelUp ? 0 : cubesBefore} size="m" />
        </div>
      </div>
      {levelUp ? <p className={styles.level}>Level {levelAfter}!</p> : null}
      {shown.length ? (
        <div className={styles.stickerRow}>
          <ul className={styles.stickers}>
            {shown.map((s) => (
              <li key={s.id} className={styles.sticker} data-sticker={s.id}>
                <StickerArt art={s.art} size={72} />
                <span className={styles.stickerLabel}>{s.label}</span>
              </li>
            ))}
          </ul>
          {more > 0 ? <p className={styles.more}>+{more} more</p> : null}
        </div>
      ) : null}
      <div className={styles.weekRow}>
        <WeekDots days={week.days} size="m" />
        <p className={styles.weekLine}>{weekLine(week)}</p>
      </div>
    </div>
  );
}
