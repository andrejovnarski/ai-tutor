import { SKILLS } from "../../domain/curriculum";
import type { Feedback, Turn } from "../../domain/session/types";
import type { AgeBand, Visual } from "../../domain/types";
import { numbersIn } from "./guards";
import type { TurnPlan } from "./types";

type ProblemTurn = Extract<Turn, { kind: "problem" }>;

const uniq = (ns: number[]) => [...new Set(ns)];
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

/** Every number a kid could see in the visual. */
export function visualNumbers(v: Visual): number[] {
  switch (v.kind) {
    case "objects":
      return uniq([...v.groups, sum(v.groups), ...(v.crossedOut !== undefined ? [v.crossedOut] : [])]);
    case "ten-frames":
      return uniq([v.first, v.second, v.first + v.second, ...(v.crossedOut !== undefined ? [v.crossedOut] : [])]);
    case "number-line": {
      const ns = [v.from, v.to, ...v.marks];
      if (v.jump) ns.push(v.jump.from, v.jump.by, v.jump.from + v.jump.by, v.jump.from - v.jump.by);
      return uniq(ns.filter((n) => n >= 0));
    }
    case "blocks": {
      const ns: number[] = [];
      for (const g of v.groups) ns.push(g.tens, g.ones, g.tens * 10 + g.ones);
      if (v.crossedOut) ns.push(v.crossedOut.tens, v.crossedOut.ones, v.crossedOut.tens * 10 + v.crossedOut.ones);
      return uniq(ns);
    }
    case "equation":
      return uniq(numbersIn(v.text));
    case "story":
      return uniq([
        ...numbersIn(v.text),
        ...(v.groups ? [...v.groups, sum(v.groups)] : []),
        ...(v.crossedOut !== undefined ? [v.crossedOut] : []),
      ]);
  }
}

function base(turn: ProblemTurn, ageBand: AgeBand, recentLines: string[]): Omit<TurnPlan, "event"> {
  const { prompt, answer } = turn.problem;
  return {
    ageBand,
    skill: SKILLS.find((s) => s.id === turn.skillId)?.name ?? turn.skillId,
    problem: prompt.say,
    problemNumbers: uniq([...numbersIn(prompt.say), ...visualNumbers(prompt.show)]),
    answer,
    recentLines: recentLines.slice(-3),
  };
}

export function presentPlan(turn: ProblemTurn, ageBand: AgeBand, recentLines: string[]): TurnPlan {
  return { event: "present", ...base(turn, ageBand, recentLines) };
}

export function feedbackPlan(
  turn: ProblemTurn, feedback: Feedback, given: number, ageBand: AgeBand, recentLines: string[],
): TurnPlan {
  const b = { ...base(turn, ageBand, recentLines), kidAnswer: given };
  if (feedback.result.kind === "correct")
    return { event: feedback.mastered.length > 0 ? "celebrate" : "correct", ...b };
  const mistakeTag = feedback.result.kind === "known-mistake" ? feedback.result.tag : undefined;
  if (feedback.reveal) return { event: "explain", ...b, revealed: true, ...(mistakeTag && { mistakeTag }), ...(feedback.style && { style: feedback.style }) };
  if (feedback.then === "retry")
    return { event: "wrong", ...b, ...(mistakeTag && { mistakeTag }), ...(feedback.style && { style: feedback.style }) };
  return { event: "hint", ...b, ...(mistakeTag && { mistakeTag }) };
}

export function kidSaidPlan(turn: ProblemTurn, kidSaid: string, ageBand: AgeBand, recentLines: string[]): TurnPlan {
  return { event: "kid-said", ...base(turn, ageBand, recentLines), kidSaid: kidSaid.slice(0, 200) };
}

export function fillName(say: string, nickname: string): string {
  return say.replaceAll("{name}", nickname.trim() || "friend");
}
