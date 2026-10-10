import type { AgeBand } from "@/domain/types";
import styles from "./play.module.css";

export function LineBubble({
  say,
  note,
  ageBand,
}: {
  say: string;
  note?: string;
  ageBand: AgeBand;
}) {
  const size = ageBand === "5-7" ? 28 : 22;
  return (
    <div className={styles.bubble} role="status" aria-live="polite" style={{ fontSize: `${size}px` }}>
      <div>{say}</div>
      {note ? (
        <div className={styles.note} data-note>
          {note}
        </div>
      ) : null}
    </div>
  );
}
