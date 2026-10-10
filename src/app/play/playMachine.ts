// Pure play state machine and request runner. Framework-free: no React, no timers, no global fetch.
import { revealNote, type PublicTurn } from "../../server/publicTurn";

export type TutorLine = { say: string; show?: string; tone: "cheer" | "calm" | "curious" };
export type EndTurn = Extract<PublicTurn, { kind: "end" }>;
export type Summary = EndTurn["summary"];

export type PlayState = {
  phase: "loading" | "problem" | "sending" | "retrying" | "offline" | "ended";
  version?: number;
  turn?: PublicTurn;
  line?: TutorLine;
  note?: string | null;
  /** Feedback line to show briefly before `line` (only when the problem moved on). */
  message?: string;
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
  | { type: "ended"; summary: Summary; line?: TutorLine };

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
        note, correct,
      };
    }
    case "retrying":
      return state.phase === "sending" || state.phase === "retrying" || state.phase === "loading"
        ? { ...state, phase: "retrying", attempt: ev.attempt }
        : state;
    case "offline":
      return { ...state, phase: "offline", attempt: undefined };
    case "ended":
      return { phase: "ended", version: state.version, turn: state.turn, summary: ev.summary, line: ev.line ?? state.line };
  }
}

export const RETRY_DELAYS = [500, 1000, 2000, 4000] as const;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
export type SleepFn = (ms: number) => Promise<void>;
export type Req = { url: string; init?: RequestInit; onRetry?: (attempt: number) => void };

/** Retries a network error or status >= 500 at 0.5, 1, 2 and 4 s (4 retries). Other statuses are returned as is. */
export async function runRequest(fetchFn: FetchFn, sleep: SleepFn, req: Req): Promise<Response | "offline"> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetchFn(req.url, req.init);
      if (r.status < 500) return r;
    } catch {
      // network error: fall through to retry
    }
    if (i >= RETRY_DELAYS.length) return "offline";
    req.onRetry?.(i + 1);
    await sleep(RETRY_DELAYS[i]!);
  }
}
