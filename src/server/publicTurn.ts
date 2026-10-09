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
