import type { AgeBand } from "@/domain/types";
import type { NovaTone } from "./Nova";
import styles from "./play.module.css";

export function LineBubble({
  say,
  lead,
  note,
  tone,
  ageBand,
}: {
  say: string;
  /** A line shown above `say` (the feedback line when reduced motion skips the timed swap). */
  lead?: string;
  note?: string;
  tone?: NovaTone;
  ageBand: AgeBand;
}) {
  const size = ageBand === "5-7" ? 28 : 22;
  return (
    <div
      className={styles.bubble}
      role="status"
      aria-live="polite"
      data-testid="nova-line"
      {...(tone ? { "data-tone": tone } : {})}
      style={{ fontSize: `${size}px` }}
    >
      {lead ? <div className={styles.lead} data-lead>{lead}</div> : null}
      {/* the note belongs to the feedback line: after the lead when there is one, else after the line */}
      {lead && note ? <div className={styles.note} data-note>{note}</div> : null}
      <div>{say}</div>
      {!lead && note ? <div className={styles.note} data-note>{note}</div> : null}
    </div>
  );
}
