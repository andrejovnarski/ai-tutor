import type { Progress } from "@/domain/rewards/progress";
import { stickerById, type Sticker } from "@/domain/rewards/stickers";
import { monthDay } from "@/server/kidRecord";
import { Rod } from "../../rewards/Rod";
import { StickerArt } from "../../rewards/StickerArt";
import styles from "./grownup.module.css";

const count = (id: string) => id.split(":")[1] ?? "";

/** The plain-words reason after a sticker's label on the child page. */
export function stickerReason(s: Sticker): string {
  switch (s.kind) {
    case "skill": return "mastered in practice";
    case "topic": return "every skill in the topic";
    case "first": return "first finished game";
    case "weeks": return count(s.id) === "1" ? "week goal met 1 time" : `week goal met ${count(s.id)} times`;
    case "tries": return count(s.id) === "1" ? "kept going on 1 tricky problem" : `kept going on ${count(s.id)} tricky problems`;
  }
}

export function RewardsSection({ nickname, progress }: { nickname: string; progress: Progress }) {
  const stickers = progress.stickers.flatMap((e) => {
    const s = stickerById(e.id);
    return s ? [{ ...e, sticker: s }] : [];
  });
  const n = progress.weekStreak;
  return (
    <section className={styles.section}>
      <h2>Rewards</h2>
      <p className={styles.rewardLine}>
        <b>{`Level ${progress.level}`}</b>
        <Rod filled={progress.cubesInRod} size="s" look="shell" />
      </p>
      <p>{n === 0 ? "Week goal: 3 days a week" : `Week goal met ${n === 1 ? "1 week" : `${n} weeks`} in a row`}</p>
      {stickers.length === 0 ? (
        <p className={styles.quiet}>{`No stickers yet. They show up as ${nickname} plays.`}</p>
      ) : (
        <ul className={styles.recordList}>
          {stickers.map(({ id, at, sticker }) => (
            <li key={id} className={styles.stickerRow}>
              <StickerArt art={sticker.art} size={36} />
              <span>{`${sticker.label} — ${stickerReason(sticker)}, ${monthDay.format(new Date(at))}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
