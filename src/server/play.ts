// Server-side play loop: the engine runs here, the browser only sees PublicTurn.
import { answer, nextTurn, startSession, summaryOf } from "../domain/session/engine";
import type { Feedback, Pending, Session, Turn, Writes } from "../domain/session/types";
import { nyDay } from "./nyDay";
import type { OpenSession, Repo } from "./persist/repo";
import { publicTurn, type PublicTurn } from "./publicTurn";
import { cannedLine } from "./tutor/canned";
import { feedbackPlan, kidSaidPlan, presentPlan } from "./tutor/plan";
import { TutorLineSchema, type TurnPlan, type TutorEvent, type TutorLine } from "./tutor/types";

export type { PublicTurn };
/** Turns a plan into a line. The route passes the guarded voice; tests and the default use canned lines. */
export type Speak = (plan: TurnPlan, seed: number) => Promise<TutorLine>;
const cannedSpeak: Speak = async (plan, seed) => cannedLine(plan, seed);

/** Lines here are raw: `{name}` is still a placeholder. The route fills it; the nickname never reaches play or a plan. */
export type TurnResult = { status: 200; version: number; turn: PublicTurn; line?: TutorLine } | { status: 404 };
/** `revealed` is the finished problem's answer, present only when feedback.reveal is true (spec §7). */
export type AnswerResult =
  | { status: 200; version: number; feedback: Feedback; next: PublicTurn; revealed?: number; line: TutorLine; nextLine?: TutorLine }
  | { status: 409; version: number; turn: PublicTurn; line?: TutorLine }
  | { status: 404 };

type ProblemTurn = Extract<Turn, { kind: "problem" }>;
type Step = { version: number; turn: Turn; line?: TutorLine };
type Ctx = { repo: Repo; kidId: string; now: number; seed: () => number; speak: Speak };
const MAX_ATTEMPTS = 5;

// Nova's last few lines live in the session state jsonb next to the engine's fields, under keys the engine never
// reads (src/domain stays unchanged). They are written only by save_step, so the version check governs them too.
// tutorLine is the full line for the problem on screen (its present line, or the wrong line on a retry), saved in the
// same step as that pending problem, so a reload or a 409 can give it back without asking for a new one.
type Stored = Session & { tutorRecent?: string[]; tutorLine?: TutorLine };
const RECENT = 3;
const recentOf = (s: Session): string[] => {
  const r = (s as Stored).tutorRecent;
  return Array.isArray(r) ? r.filter((x) => typeof x === "string").slice(-RECENT) : [];
};
const lineOf = (s: Session): TutorLine | undefined => {
  const r = TutorLineSchema.safeParse((s as Stored).tutorLine);
  return r.success ? r.data : undefined;
};
const withLines = (s: Session, recent: string[], onScreen: TutorLine | undefined): Session => {
  const { tutorLine: _old, ...rest } = s as Stored;
  return { ...rest, tutorRecent: recent.slice(-RECENT), ...(onScreen ? { tutorLine: onScreen } : {}) } as Stored;
};

/** Per-line seed: the version the line belongs to plus the event, so canned lines rotate from step to step. */
const EVENTS: TutorEvent[] = ["present", "correct", "wrong", "hint", "explain", "celebrate", "kid-said"];
const seedFor = (version: number, event: TutorEvent) => version + EVENTS.indexOf(event);

const pendingTurn = (p: Pending): ProblemTurn => ({
  kind: "problem", problem: p.problem, skillId: p.skillId, templateId: p.templateId, seed: p.seed,
  level: p.level, mode: p.mode, try: p.try, logs: [], style: p.style ?? null, // older sessions: no style key
});

/** The present line for a problem turn shown at `version`; undefined for an end turn. */
function present(c: Ctx, turn: Turn, s: Session, version: number): Promise<TutorLine | undefined> {
  if (turn.kind !== "problem") return Promise.resolve(undefined);
  return c.speak(presentPlan(turn, s.kid.ageBand, recentOf(s)), seedFor(version, "present"));
}

/** Starts a new session for the kid and takes its first turn. Null if the kid is gone or another request created a session first. */
async function startFresh(c: Ctx): Promise<Step | null> {
  const kid = await c.repo.loadKid(c.kidId);
  if (!kid) return null;
  const created = await c.repo.createSession(c.kidId, startSession(kid, c.seed(), c.now));
  if (!created) return null;
  const { session, turn } = nextTurn(created.state, c.now);
  const line = await present(c, turn, created.state, created.version + 1);
  const version = await c.repo.saveStep(created, withLines(session, line ? [line.say] : [], line), turn.kind === "end", null);
  return version < 0 ? null : { version, turn, line };
}

/** Saves the step that produced `turn` with the lines said for it; an end turn ends the session.
 * `onScreen` is the line that goes with `turn`: its present line, or the feedback line on a retry. */
async function commit(c: Ctx, open: OpenSession, session: Session, turn: Turn, writes: Writes | null,
  said: { feedback?: TutorLine; present?: TutorLine }, onScreen: TutorLine | undefined = said.present): Promise<Step | null> {
  const lines = [said.feedback, said.present].flatMap((l) => (l ? [l.say] : []));
  const stored = withLines(session, [...recentOf(open.state), ...lines], turn.kind === "end" ? undefined : onScreen);
  const version = await c.repo.saveStep(open, stored, turn.kind === "end", writes);
  if (version < 0) return null;
  return { version, turn, line: said.present };
}

/** A session's day is the New York date of its last activity (spec: the end card stays up until NY midnight). */
const endedToday = (c: Ctx, s: Session) => nyDay(s.lastActivity) === nyDay(c.now);

/** The end card of the kid's last session if it ended today and had answered problems (an empty one never says
 * "Great work today!"); its summary is rebuilt from the saved state. */
async function todaysEndCard(c: Ctx): Promise<Step | null> {
  const last = await c.repo.lastEnded(c.kidId);
  if (!last || !endedToday(c, last.state) || last.state.problems === 0) return null;
  return { version: last.version, turn: { kind: "end", summary: summaryOf(last.state, last.state.lastActivity) } };
}

/** The kid's current step. With `endCard`, a session that ended today shows its end card; without (Play again),
 * the kid always gets a problem. Throws if none can be had after a few tries (racing writers or a failing repo). */
async function current(c: Ctx, endCard = true): Promise<Step> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const open = await c.repo.openSession(c.kidId);
    if (!open) {
      const step = (endCard ? await todaysEndCard(c) : null) ?? await startFresh(c);
      if (step) return step;
      continue;
    }
    const { session, turn } = nextTurn(open.state, c.now);
    // A problem already on screen is returned as is: saving would bump the version under the client.
    // Its stored line comes back with it (no new Claude call). A session saved before lines were stored has none:
    // then a present line is spoken (same seed) but not recorded, since recording would need a write.
    if (turn.kind === "problem" && open.state.pending?.shown)
      return { version: open.version, turn, line: lineOf(open.state) ?? await present(c, turn, open.state, open.version) };
    const line = await present(c, turn, open.state, open.version + 1);
    const step = await commit(c, open, session, turn, null, { present: line });
    // A session the engine ends here (gone stale) is saved, then the next round gives its end card (only on its own
    // day, and the same one a reload shows) or a fresh session.
    if (step && turn.kind !== "end") return step;
  }
  throw new Error(`play: no current turn for kid ${c.kidId} after ${MAX_ATTEMPTS} tries`);
}

const turnResult = ({ version, turn, line }: Step): TurnResult =>
  ({ status: 200, version, turn: publicTurn(turn), ...(line ? { line } : {}) });

export async function playTurn(repo: Repo, kidId: string, now: number, seed: () => number,
  speak: Speak = cannedSpeak): Promise<TurnResult> {
  if (!(await repo.loadKid(kidId))) return { status: 404 };
  return turnResult(await current({ repo, kidId, now, seed, speak }));
}

/** Play again: the open session's step if another tablet already started one, otherwise a fresh session.
 * Never an end card. */
export async function playAgain(repo: Repo, kidId: string, now: number, seed: () => number,
  speak: Speak = cannedSpeak): Promise<TurnResult> {
  if (!(await repo.loadKid(kidId))) return { status: 404 };
  return turnResult(await current({ repo, kidId, now, seed, speak }, false));
}

export async function playAnswer(repo: Repo, kidId: string, version: number, given: number, now: number,
  seed: () => number, speak: Speak = cannedSpeak): Promise<AnswerResult> {
  if (!(await repo.loadKid(kidId))) return { status: 404 };
  const c: Ctx = { repo, kidId, now, seed, speak };
  const conflict = async (): Promise<AnswerResult> => {
    const step = await current(c);
    return { status: 409, version: step.version, turn: publicTurn(step.turn), ...(step.line ? { line: step.line } : {}) };
  };

  const open = await repo.openSession(kidId);
  if (!open || open.version !== version) return conflict();
  const taken = answer(open.state, given, now);
  if (!taken) return conflict();

  const { session, turn } = nextTurn(taken.session, now);
  const answered = pendingTurn(open.state.pending!);
  const recent = recentOf(open.state);
  const plan = feedbackPlan(answered, taken.feedback, given, open.state.kid.ageBand, recent);
  // Both lines at once: the feedback for this answer and the present line for the next problem. A retry keeps the
  // same problem on screen (try 2), so there is no new problem to present: the wrong line stays Nova's line.
  const retry = taken.feedback.then === "retry" && turn.kind === "problem";
  const [line, presentLine] = await Promise.all([
    speak(plan, seedFor(open.version + 1, plan.event)),
    retry ? Promise.resolve(undefined) : present(c, turn, open.state, open.version + 1),
  ]);
  const step = await commit(c, open, session, turn, taken.writes, { feedback: line, present: presentLine },
    retry ? line : presentLine);
  if (!step) return conflict();
  const result: AnswerResult = {
    status: 200, version: step.version, feedback: taken.feedback, next: publicTurn(step.turn), line,
    ...(step.line ? { nextLine: step.line } : {}),
  };
  if (taken.feedback.reveal) result.revealed = open.state.pending!.problem.answer;
  return result;
}

/** Nova's steer-back to the problem on screen after off-topic speech. Reads only: nothing the kid said is saved.
 * Null for an unknown kid. */
export async function playSay(repo: Repo, kidId: string, kidSaid: string, seed: number,
  speak: Speak = cannedSpeak): Promise<TutorLine | null> {
  const kid = await repo.loadKid(kidId);
  if (!kid) return null;
  const open = await repo.openSession(kidId);
  const p = open?.state.pending;
  if (!open || !p) {
    // No problem to talk about: a canned steer-back. The plan carries no problem and no kid text.
    return cannedLine({ event: "kid-said", ageBand: kid.ageBand, skill: "", problem: "", problemNumbers: [], answer: 0,
      recentLines: [] }, seed);
  }
  return speak(kidSaidPlan(pendingTurn(p), kidSaid, open.state.kid.ageBand, recentOf(open.state)), seed);
}
