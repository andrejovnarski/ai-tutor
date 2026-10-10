// Pure play state machine and request runner. Framework-free: no React, no timers, no global fetch.
import { revealNote, type PublicTurn } from "../../server/publicTurn";

export type TutorLine = { say: string; show?: string; tone: "cheer" | "calm" | "curious" };
export type EndTurn = Extract<PublicTurn, { kind: "end" }>;
export type Summary = EndTurn["summary"];

export type PlayState = {
  /** "gone": a 401 or 404 after the page loaded (session expired, kid removed); the screen leaves for `/`. */
  phase: "loading" | "problem" | "sending" | "retrying" | "offline" | "ended" | "gone";
  version?: number;
  turn?: PublicTurn;
  line?: TutorLine;
  note?: string | null;
  /** Feedback line to show briefly before `line` (only when the problem moved on). */
  message?: string;
  /** The feedback line's own tone, for Nova's face while `message` is held in the bubble. */
  messageTone?: TutorLine["tone"];
  summary?: Summary;
  /** 1..4 while phase is "retrying". */
  attempt?: number;
  /** True only when the last 200 answer was correct. */
  correct?: boolean;
};

export type AnswerBody = {
  version: number;
  feedback: { result: { kind: string }; then: "retry" | "next"; reveal: boolean };
  next: PublicTurn;
  line: TutorLine;
  nextLine?: TutorLine;
  revealed?: number;
};
export type StepBody = { version: number; turn: PublicTurn; line?: TutorLine };

export type PlayEvent =
  | { type: "load" }
  | { type: "loaded"; body: StepBody }
  | { type: "send" }
  | { type: "answered"; body: AnswerBody }
  | { type: "conflict"; body: StepBody }
  | { type: "retrying"; attempt: number }
  | { type: "offline" }
  | { type: "gone" };

export const initialPlayState: PlayState = { phase: "loading" };

export function playReducer(state: PlayState, ev: PlayEvent): PlayState {
  switch (ev.type) {
    case "load":
      return { phase: "loading" };
    case "send":
      return state.phase === "problem" ? { ...state, phase: "sending", attempt: undefined } : state;
    case "loaded":
    case "conflict": {
      const { version, turn, line } = ev.body;
      if (turn.kind === "end") return { phase: "ended", version, turn, summary: turn.summary, line };
      return { phase: "problem", version, turn, line, note: null, message: undefined, correct: false };
    }
    case "answered": {
      const b = ev.body;
      const correct = b.feedback.result.kind === "correct";
      const note = revealNote(b.line.say, b.feedback.reveal, b.revealed);
      if (b.next.kind === "end") {
        return { phase: "ended", version: b.version, turn: b.next, summary: b.next.summary, line: b.line, note, correct };
      }
      return {
        phase: "problem", version: b.version, turn: b.next,
        line: b.nextLine ?? b.line,
        message: b.nextLine ? b.line.say : undefined,
        messageTone: b.nextLine ? b.line.tone : undefined,
        note, correct,
      };
    }
    case "retrying":
      return state.phase === "sending" || state.phase === "retrying" || state.phase === "loading"
        ? { ...state, phase: "retrying", attempt: ev.attempt }
        : state;
    case "offline":
      return { ...state, phase: "offline", attempt: undefined };
    case "gone":
      return { phase: "gone" };
  }
}

/** A 401 (signed out) or 404 (kid not this parent's any more) once the page has loaded: leave rather than retry. */
export const isGone = (status: number) => status === 401 || status === 404;

export const RETRY_DELAYS = [500, 1000, 2000, 4000] as const;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
export type SleepFn = (ms: number, signal?: AbortSignal) => Promise<void>;
export type Req = { url: string; init?: RequestInit; onRetry?: (attempt: number) => void; signal?: AbortSignal };

/** Retries a network error or status >= 500 at 0.5, 1, 2 and 4 s (4 retries). Other statuses are returned as is.
 * Once `signal` aborts (the kid left the screen) nothing more is fetched or retried, and the result is "aborted". */
export async function runRequest(fetchFn: FetchFn, sleep: SleepFn, req: Req): Promise<Response | "offline" | "aborted"> {
  const { signal } = req;
  const init = signal ? { ...req.init, signal } : req.init;
  for (let i = 0; ; i++) {
    if (signal?.aborted) return "aborted";
    try {
      const r = await fetchFn(req.url, init);
      if (r.status < 500) return r;
    } catch {
      // network error (or the abort): fall through to retry
    }
    if (signal?.aborted) return "aborted";
    if (i >= RETRY_DELAYS.length) return "offline";
    req.onRetry?.(i + 1);
    try {
      await sleep(RETRY_DELAYS[i]!, signal);
    } catch {
      // an abortable sleep may reject on abort; the check at the top decides
    }
  }
}
