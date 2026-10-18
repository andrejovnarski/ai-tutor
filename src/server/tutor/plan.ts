import { SKILLS } from "../../domain/curriculum";
import { styleView } from "../../domain/problems/styleView";
import type { Feedback, Turn } from "../../domain/session/types";
import type { AgeBand, Visual } from "../../domain/types";
import { numbersIn } from "./guards";
import type { TurnPlan } from "./types";

type ProblemTurn = Extract<Turn, { kind: "problem" }>;

const uniq = (ns: number[]) => [...new Set(ns)];
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

/** Components a kid can see. No derived sums, totals or landing points: those can be the answer. */
export function visualNumbers(v: Visual): number[] {
  switch (v.kind) {
    case "objects":
      return uniq([...v.groups, ...(v.crossedOut !== undefined ? [v.crossedOut] : [])]);
    case "ten-frames":
      return uniq([v.first, v.second, ...(v.crossedOut !== undefined ? [v.crossedOut] : [])]);
    case "number-line": {
      const ns = [v.from, v.to, ...v.marks];
      if (v.jump) ns.push(v.jump.from, v.jump.by);
      return uniq(ns);
    }
    case "blocks": {
      const ns: number[] = [];
      for (const g of v.groups) ns.push(g.tens, g.ones);
      if (v.crossedOut) ns.push(v.crossedOut.tens, v.crossedOut.ones);
      return uniq(ns);
    }
    case "equation":
      return uniq(numbersIn(v.text));
    case "story":
      return uniq([
        ...numbersIn(v.text),
        ...(v.groups ?? []),
        ...(v.crossedOut !== undefined ? [v.crossedOut] : []),
      ]);
  }
}

function base(turn: ProblemTurn, ageBand: AgeBand, recentLines: string[]): Omit<TurnPlan, "event"> {
  const { prompt, answer } = turn.problem;
  const show = prompt.show;
  const literal = new Set([
    ...numbersIn(prompt.say),
    ...(show.kind === "equation" || show.kind === "story" ? numbersIn(show.text) : []),
  ]);
  // The answer stays out of problemNumbers unless it is printed in the text.
  const problemNumbers = uniq([...numbersIn(prompt.say), ...visualNumbers(show)]).filter(
    (n) => n !== answer || literal.has(n));
  return {
    ageBand,
    skill: SKILLS.find((s) => s.id === turn.skillId)?.name ?? turn.skillId,
    problem: prompt.say,
    problemNumbers,
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
  // Nova names a style only when the board draws it, so a line never talks about a picture that is not there.
  const { sum } = turn.problem;
  const drawn = feedback.style && sum && styleView(feedback.style, sum) ? feedback.style : undefined;
  if (feedback.reveal) {
    // The reveal is about the board just answered on: the style's picture only on a try 2 drawn in it
    // (a wrong check answer reveals on try 1, with a style that was never drawn).
    const style = turn.try === 2 && turn.style === drawn ? drawn : undefined;
    return { event: "explain", ...b, revealed: true, ...(mistakeTag && { mistakeTag }), ...(style && { style }) };
  }
  // The retry board (try 2) draws the style picked now.
  if (feedback.then === "retry")
    return { event: "wrong", ...b, ...(mistakeTag && { mistakeTag }), ...(drawn && { style: drawn }) };
  // A finished placement problem (no retry, no reveal): the hint is a calm move-on to the problem already on screen,
  // so it gets nothing to aim a clue at.
  return { event: "hint", ...b };
}

export function kidSaidPlan(turn: ProblemTurn, kidSaid: string, ageBand: AgeBand, recentLines: string[]): TurnPlan {
  return { event: "kid-said", ...base(turn, ageBand, recentLines), kidSaid: kidSaid.slice(0, 200) };
}

export function fillName(say: string, nickname: string): string {
  return say.replaceAll("{name}", nickname.trim() || "friend");
}
