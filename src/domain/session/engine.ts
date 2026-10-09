// The session loop (spec §4): pick a skill, make a problem, check the answer, update the kid.
import { check } from "../checker/check";
import { generate, getSkill } from "../curriculum/index";
import { guessFor, isMastered } from "../kid/bkt";
import { frontier, reviewTarget } from "../kid/next";
import { finishPlacement, placementProbe, recordPlacement, startPlacement } from "../kid/placement";
import { applyFirstTry } from "../kid/state";
import { pickStyle, recordStyle } from "../kid/style";
import type { Attempt, Mode, SkillState, StyleStat } from "../kid/types";
import { adaptInput } from "../problems/build";
import { createRng, type Rng } from "../rng";
import type { Level, Problem } from "../types";
import {
  MAX_TIME_MS, SESSION_MINUTES, STALE_MS,
  type Deps, type Feedback, type LogEntry, type Pending, type Session, type Turn, type Writes,
} from "./types";

const DEFAULT_DEPS: Deps = { generate };
const RECENT = 10;

const mix = (seed: number, n: number) => (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
const stepRng = (s: Session, salt: number): Rng => createRng(mix(s.seed, s.step * 2 + salt));

export function startSession(kid: Session["kid"], seed: number, now: number): Session {
  return {
    seed, step: 0, startedAt: now, lastActivity: now, kid,
    pending: null, current: null, placement: null, check: null, windDown: null, stepBacksInRow: 0,
    count: 0, recent: [], lastStyle: {}, switchStyle: [], lastCorrect: false,
    problems: 0, firstTryCorrect: 0, mastered: [], ended: false,
  };
}

const problemTurn = (p: Pending, logs: LogEntry[]): Turn => ({
  kind: "problem", problem: p.problem, skillId: p.skillId, templateId: p.templateId,
  seed: p.seed, level: p.level, mode: p.mode, try: p.try, logs,
});

function end(s: Session, now: number): { session: Session; turn: Turn } {
  const session = { ...s, pending: null, ended: true };
  return {
    session,
    turn: {
      kind: "end",
      summary: {
        problems: s.problems, firstTryCorrect: s.firstTryCorrect,
        minutes: Math.round((now - s.startedAt) / 60_000), mastered: s.mastered,
      },
    },
  };
}

/** Builds a problem for the skill, falling back to its other templates if one throws (spec §9). */
function serve(s: Session, now: number, deps: Deps, skillId: string, level: Level, mode: Mode, logs: LogEntry[] = []) {
  const next = { ...s, step: s.step + 1 };
  const rng = stepRng(next, 0);
  const seed = rng.int(0, 2 ** 31 - 1);
  for (const templateId of rng.shuffle(getSkill(skillId).templates)) {
    let problem: Problem;
    try {
      problem = deps.generate(templateId, seed, level);
    } catch (e) {
      logs.push({ type: "template-failed", skillId, detail: `${templateId}: ${String(e)}` });
      continue;
    }
    const pending: Pending = {
      skillId, templateId, seed, level, mode, try: 1, presentedAt: now, style: null,
      problem: adaptInput(problem, s.kid.ageBand),
    };
    return { session: { ...next, pending, lastActivity: now }, turn: problemTurn(pending, logs) };
  }
  return end(next, now);
}

export function nextTurn(s: Session, now: number, deps: Deps = DEFAULT_DEPS): { session: Session; turn: Turn } {
  if (s.ended) return end(s, now);
  if (now - s.lastActivity > STALE_MS) return end(s, now);
  if (s.pending) return { session: s, turn: problemTurn(s.pending, []) };

  if (!s.kid.placed) {
    const placement = s.placement ?? startPlacement(s.kid.grade);
    const probe = placementProbe(placement)!;
    return serve({ ...s, placement }, now, deps, probe.skillId, probe.level, "placement");
  }

  const [minMinutes] = SESSION_MINUTES[s.kid.ageBand];
  if (now - s.startedAt >= minMinutes * 60_000 && s.lastCorrect) return end(s, now);

  const current = s.current ?? frontier(s.kid);
  if (current) return serve({ ...s, current, count: s.count + 1 }, now, deps, current, s.kid.skills[current]!.level, "practice");
  const review = reviewTarget(s.kid, null);
  if (review) return serve({ ...s, count: s.count + 1 }, now, deps, review, s.kid.skills[review]!.level, "review");
  return end(s, now);
}

export function answer(s: Session, given: number, now: number): { session: Session; feedback: Feedback; writes: Writes } | null {
  const p = s.pending;
  if (!p || s.ended) return null;
  const result = check(p.problem, given);
  const correct = result.kind === "correct";
  const attempt: Attempt = {
    kidId: s.kid.kidId, skillId: p.skillId, templateId: p.templateId, seed: p.seed, level: p.level,
    answer: given, result: result.kind, mistakeTag: result.kind === "known-mistake" ? result.tag : null,
    style: p.style, timeMs: Math.min(MAX_TIME_MS, Math.max(0, now - p.presentedAt)), at: now, try: p.try, mode: p.mode,
  };
  const writes: Writes = { kidId: s.kid.kidId, attempts: [attempt], skillStates: [], styleStats: [] };
  const feedback: Feedback = { result, then: "next", style: null, reveal: false, mastered: [], logs: [] };
  let next: Session = { ...s, lastActivity: now, lastCorrect: correct, pending: null };

  if (p.mode === "placement") {
    next = placementAnswer(next, correct, writes);
    return { session: { ...next, problems: next.problems + 1 }, feedback, writes };
  }

  if (p.try === 1) {
    next = firstTry(next, p, correct, result.kind === "known-mistake" ? result.tag : null, now, writes, feedback);
    if (!correct) {
      const style = pickStyle(stepRng(next, 1), getSkill(p.skillId).styles, next.kid.styles, {
        tag: attempt.mistakeTag,
        exclude: next.switchStyle.includes(p.skillId) ? next.lastStyle[p.skillId] ?? null : null,
      });
      next = {
        ...next,
        pending: { ...p, try: 2, style, presentedAt: now },
        lastStyle: { ...next.lastStyle, [p.skillId]: style },
        switchStyle: next.switchStyle.filter((id) => id !== p.skillId),
      };
      return { session: next, feedback: { ...feedback, then: "retry", style }, writes };
    }
    return { session: next, feedback, writes };
  }

  // Second try: only the style learns from it.
  const styles = recordStyle(next.kid.styles, p.style!, correct);
  writes.styleStats.push(styles[p.style!] as StyleStat);
  next = { ...next, kid: { ...next.kid, styles } };
  return { session: next, feedback: { ...feedback, style: p.style, reveal: !correct }, writes };
}

function placementAnswer(s: Session, correct: boolean, writes: Writes): Session {
  const placement = recordPlacement(s.placement!, correct);
  if (placementProbe(placement)) return { ...s, placement };
  const kid = finishPlacement(s.kid, placement);
  writes.kidPlaced = true;
  writes.skillStates.push(...Object.values(kid.skills).filter((st) => st.placed));
  return { ...s, kid, placement: null, current: frontier(kid) };
}

/** First try: BKT, level, streaks; mastery moves the frontier on. */
function firstTry(s: Session, p: Pending, correct: boolean, tag: Attempt["mistakeTag"], now: number,
  writes: Writes, feedback: Feedback): Session {
  const before = s.kid.skills[p.skillId]!;
  const after: SkillState = applyFirstTry(before, { correct, tag, guess: guessFor(p.problem), now });
  writes.skillStates.push(after);
  const kid = { ...s.kid, skills: { ...s.kid.skills, [p.skillId]: after } };
  let next: Session = {
    ...s, kid,
    problems: s.problems + 1,
    firstTryCorrect: s.firstTryCorrect + (correct ? 1 : 0),
    recent: [...s.recent, correct].slice(-RECENT),
  };
  if (!isMastered(before) && isMastered(after)) {
    feedback.mastered.push(p.skillId);
    next = { ...next, mastered: [...next.mastered, p.skillId] };
    if (next.current === p.skillId) next = { ...next, current: frontier(kid), stepBacksInRow: 0 };
  }
  return next;
}
