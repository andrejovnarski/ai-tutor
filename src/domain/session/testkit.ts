// Test helpers for session tests. Not used by production code.
import { SKILLS, generate } from "../curriculum/index";
import { newKidState } from "../kid/state";
import type { KidGrade, KidState, SkillState } from "../kid/types";
import type { AgeBand } from "../types";
import { answer, nextTurn, startSession } from "./engine";
import type { Deps, Feedback, Session, Turn, Writes } from "./types";

export type ProblemTurn = Extract<Turn, { kind: "problem" }>;
export const SEC = 1000;
export const MIN = 60 * SEC;

export const wrongFor = (t: ProblemTurn) => t.problem.choices!.find((c) => c !== t.problem.answer)!;
export const rightFor = (t: ProblemTurn) => t.problem.answer;

export function setSkill(k: KidState, id: string, patch: Partial<SkillState>): KidState {
  return { ...k, skills: { ...k.skills, [id]: { ...k.skills[id]!, ...patch } } };
}

/** A placed kid: the given skills mastered by placement, nothing else. */
export function placedKid(masteredIds: string[], ageBand: AgeBand = "5-7", grade: KidGrade = "K"): KidState {
  const k = masteredIds.reduce((acc, id) => setSkill(acc, id, { pKnown: 0.95, placed: true, level: 2 }), newKidState("kid-1", ageBand, grade));
  return { ...k, placed: true };
}

export const firstSkills = (n: number) => SKILLS.slice(0, n).map((s) => s.id);

export type Step = { turn: Turn; given?: number; feedback?: Feedback; writes?: Writes };

/** Plays a session to its end (or `max` turns); `pick` chooses each answer; every answer takes `per` ms. */
export function play(s: Session, start: number, pick: (t: ProblemTurn, i: number) => number,
  opts: { per?: number; deps?: Deps; max?: number } = {}): { steps: Step[]; session: Session; now: number } {
  const per = opts.per ?? 20 * SEC;
  const steps: Step[] = [];
  let now = start;
  for (let i = 0; i < (opts.max ?? 2000); i++) {
    const { session, turn } = nextTurn(s, now, opts.deps);
    s = session;
    if (turn.kind === "end") {
      steps.push({ turn });
      return { steps, session: s, now };
    }
    now += per;
    const given = pick(turn, i);
    const r = answer(s, given, now)!;
    s = r.session;
    steps.push({ turn, given, feedback: r.feedback, writes: r.writes });
  }
  if (opts.max !== undefined) return { steps, session: s, now };
  throw new Error("session did not end");
}

export const fresh = (kid: KidState, seed = 7, now = 0) => startSession(kid, seed, now);
export { generate };
