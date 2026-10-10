import type { PublicTurn } from "../../server/publicTurn";
import { NumberPad } from "./NumberPad";
import styles from "./play.module.css";

type Props = {
  input: Extract<PublicTurn, { kind: "problem" }>["input"];
  choices?: number[];
  locked: boolean;
  onAnswer: (given: number) => void;
};

export function AnswerTray({ input, choices, locked, onAnswer }: Props) {
  // number-pad always gets the pad (ages 8-11 keep their choices on the turn); voice and drag fall back to tiles
  // when there are choices, else the pad.
  const useTiles = input === "tap-choice" || (input !== "number-pad" && choices !== undefined && choices.length > 0);
  if (useTiles) {
    return (
      <div className={styles.tiles} data-testid="choices">
        {(choices ?? []).map((n) => (
          <button key={n} type="button" className={styles.tile} disabled={locked} onClick={() => onAnswer(n)}>
            {n}
          </button>
        ))}
      </div>
    );
  }
  return <NumberPad locked={locked} onAnswer={onAnswer} />;
}
