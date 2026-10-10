// Pure mic state machine. Framework-free: no React, no timers, no fetch.
import type { HeardRoute } from "../../../domain/checker/heard";

export type MicEffectOut = { answer?: number; say?: string };
export type MicState = {
  phase: "idle" | "listening" | "thinking" | "confirm";
  version?: number;
  heard?: string;
  n?: number;
  notice?: string;
  failures: number;
  hidden: boolean;
  /** One-shot: set only by the transition that produced it, dropped by every other transition. micEffect reads it only when its identity changed. */
  effect?: MicEffectOut;
};

export type MicEvent =
  | { type: "start"; version: number }
  | { type: "sent" }
  | { type: "result"; version: number; heard: string; route: HeardRoute }
  | { type: "nothing" }
  | { type: "failed" }
  | { type: "denied" }
  | { type: "yes" }
  | { type: "no" }
  | { type: "problem"; version: number }
  | { type: "cancel" };

const NOTHING = "I didn't catch that. Try again or tap your answer.";
const FAILED = "I couldn't hear. Tap your answer.";

const base = (s: MicState): MicState => ({ phase: "idle", version: s.version, failures: s.failures, hidden: s.hidden });

export function micReducer(s: MicState, ev: MicEvent): MicState {
  switch (ev.type) {
    case "start":
      return s.hidden || s.phase !== "idle" ? s : { ...base(s), phase: "listening", version: ev.version };
    case "sent":
      return s.phase === "listening" ? { ...s, phase: "thinking", effect: undefined } : s;
    case "result": {
      if ((s.phase !== "listening" && s.phase !== "thinking") || ev.version !== s.version) return base(s);
      const b = { ...base(s), failures: 0 };
      const r = ev.route;
      if (r.kind === "answer") return { ...b, effect: { answer: r.n } };
      if (r.kind === "confirm") return { ...b, phase: "confirm", n: r.n, heard: ev.heard };
      if (r.kind === "say") return { ...b, heard: ev.heard, effect: { say: r.text } };
      return { ...b, notice: NOTHING };
    }
    case "nothing":
      return { ...base(s), failures: 0, notice: NOTHING };
    case "failed": {
      const failures = s.failures + 1;
      return { ...base(s), failures, hidden: s.hidden || failures >= 2, notice: FAILED };
    }
    case "denied":
      return { ...base(s), hidden: true };
    case "yes":
      return s.phase === "confirm" && s.n !== undefined ? { ...base(s), effect: { answer: s.n } } : s;
    case "no":
      return s.phase === "confirm" ? { ...base(s), notice: "Let's try again." } : s;
    case "problem":
      return ev.version === s.version ? s : { ...base(s), version: ev.version };
    case "cancel":
      return base(s);
  }
}

export function micEffect(prev: MicState, next: MicState): MicEffectOut | null {
  return next.effect && next.effect !== prev.effect ? next.effect : null;
}
