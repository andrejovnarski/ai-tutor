import { styleView } from "../domain/problems/styleView";
import type { Turn } from "../domain/session/types";
import type { EndRewards } from "../domain/rewards/progress";
import type { Visual } from "../domain/types";

type ProblemTurn = Extract<Turn, { kind: "problem" }>;

/** The picture on the board: on a retry of a sum problem, the chosen style's picture if it has one. */
export function boardView(turn: ProblemTurn): Visual {
  const { style, problem } = turn;
  return (turn.try === 2 && style && problem.sum && styleView(style, problem.sum)) || problem.prompt.show;
}

/** What the browser may see. Never the answer, the known mistakes, template metadata, the style, or the sum
 * (its total is the answer). */
export type PublicTurn =
  | {
    kind: "problem"; mode: ProblemTurn["mode"]; try: 1 | 2; help: 0 | 1 | 2;
    prompt: ProblemTurn["problem"]["prompt"]; input: ProblemTurn["problem"]["input"]; choices?: number[];
  }
  | (Extract<Turn, { kind: "end" }> & { rewards?: EndRewards });

export function publicTurn(t: Turn): PublicTurn {
  if (t.kind === "end") return t;
  const { prompt, input, choices } = t.problem;
  return {
    kind: "problem", mode: t.mode, try: t.try, help: t.help, prompt: { ...prompt, show: boardView(t) }, input, ...(choices ? { choices } : {}),
  };
}

/** Safety net for the play screen: after a reveal, the answer is shown under Nova's line unless the line already
 * says it as a whole number. (The server guards make the line say it; this keeps the promise if that ever slips.) */
export function revealNote(say: string, reveal: boolean, revealed: number | undefined): string | null {
  if (!reveal || revealed === undefined) return null;
  const n = String(revealed).replace("-", "\\-");
  return new RegExp(`(^|[^\\d-])${n}(?!\\d)`).test(say) ? null : `The answer is ${revealed}.`;
}
