// Simulated kids for whole-system tests (spec §10).
import { isMastered } from "../kid/bkt";
import { getSkill } from "../curriculum/index";
import { newKidState } from "../kid/state";
import type { KidGrade, KidState, Mode } from "../kid/types";
import { createRng } from "../rng";
import { answer, help, nextTurn, startSession } from "../session/engine";
import type { Feedback, LogEntry, Turn } from "../session/types";
import type { AgeBand, MistakeTag, Style } from "../types";

export type BotProfile = { knows: Set<string>; slip: number; guess: number; learn: number; habit?: MistakeTag; forget?: { day: number; skills: string[] }; stuck?: { share: number; action: "help" | "wrong" } };

type ProblemTurn = Extract<Turn, { kind: "problem" }>;

export function makeBot(profile: BotProfile, seed: number) {
  const rng = createRng(seed);
  const knows = new Set(profile.knows);
  const wrongAnswer = (t: ProblemTurn) => {
    const p = t.problem;
    const m = p.mistakes.find((x) => x.tag === profile.habit) ?? p.mistakes[0];
    return m?.answer ?? p.choices?.find((c) => c !== p.answer) ?? p.answer + 1;
  };
  return {
    knows,
    respond(t: ProblemTurn): number | "help" {
      // A neutral wrong answer has no mistake tag, matching Help 1's learning signal.
      if (t.try === 1 && profile.stuck && rng.chance(profile.stuck.share)) {
        return profile.stuck.action === "help" ? "help" : t.problem.answer + 1000;
      }
      const p = t.problem;
      if (knows.has(t.skillId)) return rng.chance(profile.slip) ? wrongAnswer(t) : p.answer;
      if (rng.chance(profile.guess) && p.choices?.length) return rng.pick(p.choices);
      return wrongAnswer(t);
    },
    learnFrom(skillId: string, feedback: Feedback): void {
      if (!feedback.style || knows.has(skillId)) return;
      if (getSkill(skillId).needs.every((n) => knows.has(n)) && rng.chance(profile.learn)) knows.add(skillId);
    },
  };
}

export type SimResult = {
  kid: KidState;
  firstTryRate: number;
  firstTries: number;
  logs: LogEntry[];
  /** step-back / check-passed / loop-guard / mastered / end, in order. */
  trace: string[];
  learningTrace: (
    | { kind: "recall"; skillId: string; results: boolean[]; mastered: boolean; pKnownBefore: number; pKnownAfter: number }
    | { kind: "practice"; skillId: string }
  )[];
  placementIndex: number;
  modes: Mode[];
  explanations: { skillId: string; style: Style }[];
};

const ANSWER_MS = 20_000;
const DAY_MS = 24 * 60 * 60_000;

/** Plays sessions `dayGap` days apart (default 1); forget.day is a zero-based session index. */
export function simulate(
  profile: BotProfile,
  opts: { grade: KidGrade; ageBand: AgeBand; seed: number; problems: number; kid?: KidState; dayGap?: number },
): SimResult {
  const bot = makeBot(profile, opts.seed);
  let kid = opts.kid ?? newKidState("bot", opts.ageBand, opts.grade);
  const r: SimResult = {
    kid, firstTryRate: 0, firstTries: 0, logs: [], trace: [], placementIndex: 0, modes: [], explanations: [], learningTrace: [],
  };
  let right = 0;
  let answered = 0;
  let now = 0;
  for (let day = 0; answered < opts.problems; day++) {
    if (profile.forget?.day === day) for (const id of profile.forget.skills) bot.knows.delete(id);
    let s = startSession(kid, opts.seed * 1000 + day, now);
    for (;;) {
      const next = nextTurn(s, now);
      s = next.session;
      const turn = next.turn;
      if (turn.kind === "end") {
        r.trace.push("end");
        break;
      }
      r.logs.push(...turn.logs);
      if (turn.try === 1) r.modes.push(turn.mode);
      now += ANSWER_MS;
      const response = bot.respond(turn);
      const recallBefore = s.recall;
      const out = (response === "help" ? help(s, now) : answer(s, response, now))!;
      s = out.session;
      if (turn.mode === "practice" && turn.try === 1) r.learningTrace.push({ kind: "practice", skillId: turn.skillId });
      if (recallBefore?.results.length === 1 && turn.try === 1) {
        const st = s.kid.skills[turn.skillId]!;
        r.learningTrace.push({ kind: "recall", skillId: turn.skillId,
          results: [recallBefore.results[0]!.correct, out.feedback.result.kind === "correct"],
          mastered: isMastered(st), pKnownBefore: next.session.kid.skills[turn.skillId]!.pKnown, pKnownAfter: st.pKnown });
      }
      answered++;
      const fb = out.feedback;
      r.logs.push(...fb.logs);
      for (const l of fb.logs) r.trace.push(l.type);
      for (const id of fb.mastered) r.trace.push(`mastered`, id);
      if (out.writes.kidPlaced) r.placementIndex = Object.values(s.kid.skills).filter((x) => x.placed).length;
      if (fb.style) r.explanations.push({ skillId: turn.skillId, style: fb.style });
      if (turn.try === 1 && turn.mode !== "placement") {
        r.firstTries++;
        if (fb.result.kind === "correct") right++;
      }
      bot.learnFrom(turn.skillId, fb);
      if (answered >= opts.problems) break;
    }
    kid = s.kid;
    now += (opts.dayGap ?? 1) * DAY_MS;
  }
  return { ...r, kid, firstTryRate: r.firstTries ? right / r.firstTries : 0 };
}
