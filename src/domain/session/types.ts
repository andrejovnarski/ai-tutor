import type { CheckResult } from "../checker/check";
import type { PlacementState } from "../kid/placement";
import type { Attempt, KidState, Mode, SkillState, StyleStat } from "../kid/types";
import type { AgeBand, Level, Problem, Style } from "../types";

export type LogEntry = { type: "template-failed" | "step-back" | "loop-guard" | "check-passed"; skillId: string; detail?: string };

export type SessionSummary = { problems: number; firstTryCorrect: number; minutes: number; mastered: string[] };

export type Turn =
  | {
    kind: "problem"; problem: Problem; skillId: string; templateId: string; seed: number;
    level: Level; mode: Mode; try: 1 | 2; logs: LogEntry[];
  }
  | { kind: "end"; summary: SessionSummary };

export type Feedback = {
  result: CheckResult;
  then: "retry" | "next";
  /** Style to explain in (before a retry, or with the reveal). */
  style: Style | null;
  /** Say the answer: only after the second wrong try (spec §7). */
  reveal: boolean;
  mastered: string[];
  logs: LogEntry[];
};

/** Rows to save before the next problem is shown (Plan 3). */
export type Writes = { kidId: string; attempts: Attempt[]; skillStates: SkillState[]; styleStats: StyleStat[]; kidPlaced?: true };

export type Deps = { generate: (templateId: string, seed: number, level: Level) => Problem };

export type Pending = {
  skillId: string; templateId: string; seed: number; level: Level; mode: Mode;
  try: 1 | 2; presentedAt: number; style: Style | null; problem: Problem;
};

export type Check = { prereqId: string; returnTo: string; done: number };

/** All session state. Plain data: survives JSON round trips (resume, spec §9). */
export type Session = {
  seed: number;
  step: number;
  startedAt: number;
  lastActivity: number;
  kid: KidState;
  pending: Pending | null;
  current: string | null;
  placement: PlacementState | null;
  check: Check | null;
  windDown: number | null;
  stepBacksInRow: number;
  /** Practice and review problems served. */
  count: number;
  /** First-try results of practice and review, newest last, at most 10. */
  recent: boolean[];
  lastStyle: Record<string, Style>;
  switchStyle: string[];
  lastCorrect: boolean;
  /** Mode of the last practice or review problem served (low-accuracy valve fires once in a row). */
  lastMode: "practice" | "review" | null;
  problems: number;
  firstTryCorrect: number;
  mastered: string[];
  ended: boolean;
};

export const SESSION_MINUTES: Record<AgeBand, [min: number, max: number]> = { "5-7": [10, 15], "8-11": [15, 20] };
export const STALE_MS = 30 * 60_000;
export const REVIEW_EVERY = 5;
export const MAX_TIME_MS = 600_000;
