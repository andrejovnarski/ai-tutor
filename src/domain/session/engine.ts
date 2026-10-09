// The session loop (spec §4): pick a skill, make a problem, check the answer, update the kid.
import { check } from "../checker/check";
import { generate, getSkill } from "../curriculum/index";
import { guessFor, isMastered } from "../kid/bkt";
import { easyReview, frontier, isStruggling, reviewTarget, weakestPrereq } from "../kid/next";
import { finishPlacement, placementProbe, recordPlacement, startPlacement } from "../kid/placement";
import { applyFirstTry, resetStruggle } from "../kid/state";
import { pickStyle, recordStyle } from "../kid/style";
import type { Attempt, Mode, SkillState, StyleStat } from "../kid/types";
import { adaptInput } from "../problems/build";
import { createRng, type Rng } from "../rng";
import type { Level, Problem } from "../types";
import {
  MAX_TIME_MS, REVIEW_EVERY, SESSION_MINUTES, STALE_MS,
  type Deps, type Feedback, type LogEntry, type Pending, type Session, type Turn, type Writes,
} from "./types";

const DEFAULT_DEPS: Deps = { generate };
const RECENT = 10;
const LOW_ACCURACY_WRONG = 4;
const CHECK_SIZE = 2;
const MAX_STEP_BACKS = 3;
const WIND_DOWN_MAX = 3;

const mix = (seed: number, n: number) => (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
const stepRng = (s: Session, salt: number): Rng => createRng(mix(s.seed, s.step * 2 + salt));

export function startSession(kid: Session["kid"], seed: number, now: number): Session {
  return {
    seed, step: 0, startedAt: now, lastActivity: now, kid,
    pending: null, current: null, placement: null, check: null, windDown: null, stepBacksInRow: 0,
    count: 0, recent: [], lastStyle: {}, switchStyle: [], lastCorrect: false, lastMode: null,
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
      problem: adaptInput(problem, s.kid.ageBand), shown: true,
    };
    return { session: { ...next, pending, lastActivity: now }, turn: problemTurn(pending, logs) };
  }
  return end(next, now);
}

export function nextTurn(s: Session, now: number, deps: Deps = DEFAULT_DEPS): { session: Session; turn: Turn } {
  if (s.ended) return end(s, now);
  if (now - s.lastActivity > STALE_MS) return end(s, now);
  if (s.pending) {
    const pending = s.pending.shown ? s.pending : { ...s.pending, shown: true, presentedAt: now };
    return { session: { ...s, pending }, turn: problemTurn(pending, []) };
  }

  if (!s.kid.placed) {
    const placement = s.placement ?? startPlacement(s.kid.grade);
    const probe = placementProbe(placement)!;
    return serve({ ...s, placement }, now, deps, probe.skillId, probe.level, "placement");
  }

  const [minMinutes, maxMinutes] = SESSION_MINUTES[s.kid.ageBand];
  const elapsed = now - s.startedAt;
  if (s.windDown === null && elapsed >= maxMinutes * 60_000) s = { ...s, windDown: 0 };
  if (s.windDown !== null) return windDown(s, now, deps);
  if (s.check) return serve(s, now, deps, s.check.prereqId, 1, "check"); // finish a check before ending
  if (elapsed >= minMinutes * 60_000 && s.lastCorrect) return end(s, now);

  const current = s.current && !isMastered(s.kid.skills[s.current]!) ? s.current : frontier(s.kid);
  const wrong = s.recent.filter((ok) => !ok).length;
  const easy = easyReview(s.kid);
  if (wrong >= LOW_ACCURACY_WRONG && easy && s.lastMode !== "review") return review(s, now, deps, easy, 1, current);
  const due = reviewTarget(s.kid, current);
  if ((s.count + 1) % REVIEW_EVERY === 0 && due) return review(s, now, deps, due, s.kid.skills[due]!.level, current);
  if (current) return serve({ ...s, current, count: s.count + 1, lastMode: "practice" }, now, deps, current, s.kid.skills[current]!.level, "practice");
  const any = reviewTarget(s.kid, null);
  if (any) return review(s, now, deps, any, s.kid.skills[any]!.level, null);
  return end(s, now);
}

function review(s: Session, now: number, deps: Deps, skillId: string, level: Level, current: string | null) {
  return serve({ ...s, current, count: s.count + 1, lastMode: "review" }, now, deps, skillId, level, "review");
}

/** Easy problems to end on a win: stop after the first correct answer or WIND_DOWN_MAX problems. */
function windDown(s: Session, now: number, deps: Deps) {
  const served = s.windDown ?? 0;
  if (served >= WIND_DOWN_MAX || (served > 0 && s.lastCorrect)) return end(s, now);
  const skillId = easyReview(s.kid) ?? s.current ?? frontier(s.kid);
  if (!skillId) return end(s, now);
  return serve({ ...s, windDown: served + 1 }, now, deps, skillId, 1, "wind-down");
}

export function answer(s: Session, given: number, now: number): { session: Session; feedback: Feedback; writes: Writes } | null {
  const p = s.pending;
  if (!p || !p.shown || s.ended) return null;
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
    if (p.mode === "check") return checkAnswer(next, p, correct, attempt.mistakeTag, writes, feedback);
    if (!correct && p.mode === "practice") next = struggle(next, p.skillId, writes);
    if (!correct) {
      const style = pickStyle(stepRng(next, 1), getSkill(p.skillId).styles, next.kid.styles, {
        tag: attempt.mistakeTag,
        exclude: next.switchStyle.includes(p.skillId) ? next.lastStyle[p.skillId] ?? null : null,
      });
      next = {
        ...next,
        pending: { ...p, try: 2, style, presentedAt: now, shown: false },
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

/** A prerequisite check answer: no retry; a wrong answer steps back (or trips the loop guard). */
function checkAnswer(s: Session, p: Pending, correct: boolean, tag: Attempt["mistakeTag"], writes: Writes, feedback: Feedback) {
  const c = s.check!;
  if (correct) {
    if (c.done + 1 < CHECK_SIZE) return { session: { ...s, check: { ...c, done: c.done + 1 } }, feedback, writes };
    feedback.logs.push({ type: "check-passed", skillId: c.prereqId, detail: c.returnTo });
    const session = { ...s, check: null, stepBacksInRow: 0, switchStyle: [...s.switchStyle, c.returnTo] };
    return { session, feedback, writes };
  }
  const style = pickStyle(stepRng(s, 1), getSkill(p.skillId).styles, s.kid.styles, { tag });
  const shown = { ...feedback, style, reveal: true };
  if (isMastered(s.kid.skills[c.prereqId]!)) {
    // One slip on a skill still known well: no step-back, just explain the current skill another way.
    shown.logs.push({ type: "check-passed", skillId: c.prereqId, detail: `${c.returnTo} (still mastered)` });
    return { session: { ...s, check: null, switchStyle: [...s.switchStyle, c.returnTo] }, feedback: shown, writes };
  }
  if (s.stepBacksInRow + 1 > MAX_STEP_BACKS) {
    shown.logs.push({ type: "loop-guard", skillId: c.returnTo, detail: `after ${MAX_STEP_BACKS} step-backs` });
    return { session: { ...s, check: null, windDown: 0 }, feedback: shown, writes };
  }
  shown.logs.push({ type: "step-back", skillId: c.prereqId, detail: `from ${c.returnTo}` });
  const session = { ...s, check: null, current: c.prereqId, stepBacksInRow: s.stepBacksInRow + 1 };
  return { session, feedback: shown, writes };
}

/** After a wrong practice first try: a struggling kid gets a prerequisite check, or a new style. */
function struggle(s: Session, skillId: string, writes: Writes): Session {
  const st = s.kid.skills[skillId]!;
  if (!isStruggling(st)) return s;
  const reset = resetStruggle(st);
  writes.skillStates = writes.skillStates.map((x) => (x.skillId === skillId ? reset : x));
  const kid = { ...s.kid, skills: { ...s.kid.skills, [skillId]: reset } };
  const prereq = weakestPrereq(kid, skillId);
  return prereq
    ? { ...s, kid, check: { prereqId: prereq, returnTo: skillId, done: 0 } }
    : { ...s, kid, switchStyle: [...s.switchStyle, skillId] };
}
