// What the mic has to say, in a strip just above the tray: "Did you say 12?" with Yes / No, "I heard: ...", or a notice.
import styles from "../play.module.css";
import type { MicState } from "./micMachine";

export function ConfirmHeard({ n, onYes, onNo }: { n: number; onYes: () => void; onNo: () => void }) {
  return (
    <div className={styles.confirm} data-testid="confirm-heard">
      <span>Did you say {n}?</span>
      <button type="button" className={styles.confirmButton} aria-label="Yes" onClick={onYes}>
        <span aria-hidden="true">✓</span>
      </button>
      <button type="button" className={styles.confirmButton} aria-label="No" onClick={onNo}>
        <span aria-hidden="true">✗</span>
      </button>
    </div>
  );
}

/** The confirm card replaces the "I heard" line; a notice (try again, didn't catch, couldn't hear) wins over both. */
export function MicStrip({ mic, onYes, onNo }: { mic: MicState; onYes: () => void; onNo: () => void }) {
  if (mic.phase === "confirm" && mic.n !== undefined) return <ConfirmHeard n={mic.n} onYes={onYes} onNo={onNo} />;
  const say = mic.notice ?? (mic.heard ? `I heard: ${mic.heard}` : null);
  if (!say) return null;
  return <p className={styles.heard} data-testid="heard" role="status">{say}</p>;
}
