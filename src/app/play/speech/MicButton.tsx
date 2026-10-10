// The mic: at the tray's leading edge on every problem while speech is on and the mic isn't hidden.
import styles from "../play.module.css";
import type { MicState } from "./micMachine";

type Props = {
  speech: boolean;
  mic: MicState;
  /** An answer is in flight (or no problem is on screen): the mic can't start. */
  locked: boolean;
  /** Must start the recording synchronously (Safari only allows the mic from inside the tap). */
  onTap: () => void;
};

export function Mic({ speech, mic, locked, onTap }: Props) {
  if (!speech || mic.hidden) return null;
  const busy = mic.phase === "listening" || mic.phase === "thinking";
  return (
    <button
      type="button"
      className={styles.mic}
      aria-label="Talk to Nova"
      aria-pressed={busy}
      data-mic={mic.phase}
      // Off (and looking off) while /listen works and while "Did you say" waits for Yes or No.
      disabled={locked || mic.phase === "thinking" || mic.phase === "confirm"}
      onClick={() => { if (!busy) onTap(); }}
    >
      <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" focusable="false">
        <rect x="17" y="6" width="14" height="24" rx="7" fill="currentColor" />
        <path d="M11 22a13 13 0 0 0 26 0" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <line x1="24" y1="35" x2="24" y2="42" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </button>
  );
}
