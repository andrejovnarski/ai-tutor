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
  const useTiles = input === "tap-choice" || (choices !== undefined && choices.length > 0);
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
