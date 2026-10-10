import type { ReactNode } from "react";
import type { PublicTurn } from "../../server/publicTurn";
import { NumberPad } from "./NumberPad";
import styles from "./play.module.css";

type Props = {
  input: Extract<PublicTurn, { kind: "problem" }>["input"];
  choices?: number[];
  locked: boolean;
  onAnswer: (given: number) => void;
  /** The mic (speech on), at the leading edge of the tiles or pad. */
  mic?: ReactNode;
};

export function AnswerTray({ input, choices, locked, onAnswer, mic }: Props) {
  // Tiles need choices. number-pad always gets the pad (ages 8-11 keep their choices on the turn); tap-choice, voice
  // and drag get tiles when there are choices, else the pad.
  const useTiles = input !== "number-pad" && (choices?.length ?? 0) > 0;
  if (useTiles) {
    const tiles = (
      <div className={styles.tiles} data-testid="choices">
        {(choices ?? []).map((n) => (
          <button key={n} type="button" className={styles.tile} disabled={locked} onClick={() => onAnswer(n)}>
            {n}
          </button>
        ))}
      </div>
    );
    return mic ? <div className={styles.answers}>{mic}{tiles}</div> : tiles;
  }
  const pad = <NumberPad locked={locked} onAnswer={onAnswer} />;
  return mic ? <div className={[styles.answers, styles.padWithMic].join(" ")}>{mic}{pad}</div> : pad;
}
