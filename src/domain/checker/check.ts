import type { MistakeTag, Problem } from "../types";

export type CheckResult = { kind: "correct" } | { kind: "known-mistake"; tag: MistakeTag } | { kind: "wrong" };

export function check(problem: Problem, given: number): CheckResult {
  if (given === problem.answer) return { kind: "correct" };
  const mistake = problem.mistakes.find((m) => m.answer === given);
  return mistake ? { kind: "known-mistake", tag: mistake.tag } : { kind: "wrong" };
}
