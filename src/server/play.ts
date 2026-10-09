// Server-side play loop: the engine runs here, the browser only sees PublicTurn.
import { answer, nextTurn, startSession } from "../domain/session/engine";
import type { Feedback, Session, Turn, Writes } from "../domain/session/types";
import type { OpenSession, Repo } from "./persist/repo";
import { publicTurn, type PublicTurn } from "./publicTurn";

export type { PublicTurn };
export type TurnResult = { status: 200; version: number; turn: PublicTurn } | { status: 404 };
/** `revealed` is the finished problem's answer, present only when feedback.reveal is true (spec §7). */
export type AnswerResult =
  | { status: 200; version: number; feedback: Feedback; next: PublicTurn; revealed?: number }
  | { status: 409; version: number; turn: PublicTurn }
  | { status: 404 };

type Step = { version: number; turn: Turn };
const MAX_ATTEMPTS = 5;

/** Starts a new session for the kid and takes its first turn. Null if the kid is gone or another request created a session first. */
async function startFresh(repo: Repo, kidId: string, now: number, seed: () => number): Promise<Step | null> {
  const kid = await repo.loadKid(kidId);
  if (!kid) return null;
  const created = await repo.createSession(kidId, startSession(kid, seed(), now));
  if (!created) return null;
  const { session, turn } = nextTurn(created.state, now);
  const version = await repo.saveStep(created, session, turn.kind === "end", null);
  return version < 0 ? null : { version, turn };
}

/** Saves the step that produced `turn`; when it ends the session, rolls over into a new one. */
async function commit(repo: Repo, kidId: string, open: OpenSession, session: Session, turn: Turn,
  writes: Writes | null, now: number, seed: () => number): Promise<Step | null> {
  const version = await repo.saveStep(open, session, turn.kind === "end", writes);
  if (version < 0) return null;
  if (turn.kind !== "end") return { version, turn };
  return (await startFresh(repo, kidId, now, seed)) ?? current(repo, kidId, now, seed);
}

async function current(repo: Repo, kidId: string, now: number, seed: () => number): Promise<Step | null> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const open = await repo.openSession(kidId);
    if (!open) {
      const fresh = await startFresh(repo, kidId, now, seed);
      if (fresh) return fresh;
      continue;
    }
    const { session, turn } = nextTurn(open.state, now);
    // A problem already on screen is returned as is: saving would bump the version under the client.
    if (turn.kind === "problem" && open.state.pending?.shown) return { version: open.version, turn };
    const step = await commit(repo, kidId, open, session, turn, null, now, seed);
    if (step) return step;
  }
  return null;
}

export async function playTurn(repo: Repo, kidId: string, now: number, seed: () => number): Promise<TurnResult> {
  if (!(await repo.loadKid(kidId))) return { status: 404 };
  const { version, turn } = (await current(repo, kidId, now, seed))!;
  return { status: 200, version, turn: publicTurn(turn) };
}

export async function playAnswer(repo: Repo, kidId: string, version: number, given: number, now: number,
  seed: () => number): Promise<AnswerResult> {
  if (!(await repo.loadKid(kidId))) return { status: 404 };
  const conflict = async (): Promise<AnswerResult> => {
    const step = (await current(repo, kidId, now, seed))!;
    return { status: 409, version: step.version, turn: publicTurn(step.turn) };
  };

  const open = await repo.openSession(kidId);
  if (!open || open.version !== version) return conflict();
  const taken = answer(open.state, given, now);
  if (!taken) return conflict();

  const { session, turn } = nextTurn(taken.session, now);
  const step = await commit(repo, kidId, open, session, turn, taken.writes, now, seed);
  if (!step) return conflict();
  const result: AnswerResult = { status: 200, version: step.version, feedback: taken.feedback, next: publicTurn(step.turn) };
  if (taken.feedback.reveal) result.revealed = open.state.pending!.problem.answer;
  return result;
}
