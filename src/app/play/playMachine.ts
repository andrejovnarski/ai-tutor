// Pure play state machine and request runner. Framework-free: no React, no timers, no global fetch.
import type { LineSpeech } from "../../server/speech/lineSpeech";
import { revealNote, type PublicTurn } from "../../server/publicTurn";

export type TutorLine = { say: string; show?: string; tone: "cheer" | "calm" | "curious"; speech?: LineSpeech };
export type EndTurn = Extract<PublicTurn, { kind: "end" }>;
export type Summary = EndTurn["summary"];
export type Rewards = NonNullable<EndTurn["rewards"]>;

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
  /** What to voice for `message` (speech on only). Set wherever `message` is set. */
  messageSpeech?: LineSpeech;
  summary?: Summary;
  /** What the finished session earned; absent when rewards are off or could not be loaded. */
  rewards?: Rewards;
  /** 1..4 while phase is "retrying". */
  attempt?: number;
  /** The submission being sent or retried; absent for a turn load. */
  request?: "answer" | "help";
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
  | { type: "send"; request?: "answer" | "help" }
  | { type: "answered"; body: AnswerBody }
  | { type: "conflict"; body: StepBody }
  | { type: "retrying"; attempt: number }
  | { type: "offline" }
  | { type: "gone" }
  /** Nova's reply to something the kid said (not a number): shown above the problem's line; the problem stays. */
  | { type: "said"; line: TutorLine };

export const initialPlayState: PlayState = { phase: "loading" };

export function playReducer(state: PlayState, ev: PlayEvent): PlayState {
  switch (ev.type) {
    case "load":
      return { phase: "loading" };
    case "send":
      return state.phase === "problem" ? { ...state, phase: "sending", attempt: undefined, request: ev.request ?? "answer" } : state;
    case "loaded":
    case "conflict": {
      const { version, turn, line } = ev.body;
      if (turn.kind === "end") return { phase: "ended", version, turn, summary: turn.summary, rewards: turn.rewards, line };
      return { phase: "problem", version, turn, line, note: null, message: undefined, messageSpeech: undefined, correct: false };
    }
    case "answered": {
      const b = ev.body;
      const correct = b.feedback.result.kind === "correct";
      const note = revealNote(b.line.say, b.feedback.reveal, b.revealed);
      if (b.next.kind === "end") {
        return { phase: "ended", version: b.version, turn: b.next, summary: b.next.summary, rewards: b.next.rewards, line: b.line, note, correct };
      }
      return {
        phase: "problem", version: b.version, turn: b.next,
        line: b.nextLine ?? b.line,
        message: b.nextLine ? b.line.say : undefined,
        messageTone: b.nextLine ? b.line.tone : undefined,
        messageSpeech: b.nextLine ? b.line.speech : undefined,
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
    case "said":
      // The reply leads (no hold, not correct); a reveal note belonged to an earlier feedback line, so it goes.
      return state.phase === "problem"
        ? { ...state, message: ev.line.say, messageTone: ev.line.tone, messageSpeech: ev.line.speech, note: null, correct: false }
        : state;
  }
}

/** Nova's reply from a /say body, whatever its status: a 5xx still carries the distress line when storing it failed, and
 * the child must see (and hear) it. Null when there is no reply to show. */
export function replyLine(body: unknown): TutorLine | null {
  if (typeof body !== "object" || body === null) return null;
  const { reply, replySpeech } = body as { reply?: unknown; replySpeech?: unknown };
  if (typeof reply !== "string" || !reply) return null;
  const sp = replySpeech as Partial<LineSpeech> | undefined;
  const speech = sp && typeof sp.text === "string" && typeof sp.token === "string"
    ? { text: sp.text, token: sp.token, ...(typeof sp.clip === "string" ? { clip: sp.clip } : {}) }
    : undefined;
  return { say: reply, tone: "calm", ...(speech ? { speech } : {}) };
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
