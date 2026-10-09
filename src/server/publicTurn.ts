import type { Turn } from "../domain/session/types";

type ProblemTurn = Extract<Turn, { kind: "problem" }>;

/** What the browser may see. Never the answer, the known mistakes, or template metadata. */
export type PublicTurn =
  | {
    kind: "problem"; mode: ProblemTurn["mode"]; try: 1 | 2;
    prompt: ProblemTurn["problem"]["prompt"]; input: ProblemTurn["problem"]["input"]; choices?: number[];
  }
  | Extract<Turn, { kind: "end" }>;

export function publicTurn(t: Turn): PublicTurn {
  if (t.kind === "end") return t;
  const { prompt, input, choices } = t.problem;
  return { kind: "problem", mode: t.mode, try: t.try, prompt, input, ...(choices ? { choices } : {}) };
}

/** Safety net for the play screen: after a reveal, the answer is shown under Nova's line unless the line already
 * says it as a whole number. (The server guards make the line say it; this keeps the promise if that ever slips.) */
export function revealNote(say: string, reveal: boolean, revealed: number | undefined): string | null {
  if (!reveal || revealed === undefined) return null;
  const n = String(revealed).replace("-", "\\-");
  return new RegExp(`(^|[^\\d-])${n}(?!\\d)`).test(say) ? null : `The answer is ${revealed}.`;
}
