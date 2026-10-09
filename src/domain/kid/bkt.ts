// Bayesian Knowledge Tracing: how likely the kid knows a skill.
import type { Problem } from "../types";
import type { SkillState } from "./types";

export type BktParams = { prior: number; learn: number; slip: number };

export const BKT_DEFAULTS: BktParams = { prior: 0.2, learn: 0.15, slip: 0.1 };
/** Per-skill tuning, filled from real data later (spec §6). */
export const BKT_OVERRIDES: Record<string, Partial<BktParams>> = {};
export const MASTERED_P = 0.95;
export const MASTERED_ATTEMPTS = 5;

export function bktParams(skillId: string): BktParams {
  return { ...BKT_DEFAULTS, ...BKT_OVERRIDES[skillId] };
}

/** Chance of a lucky right answer, from how the kid answered. */
export function guessFor(p: Problem): number {
  if (p.input === "number-pad" || !p.choices?.length) return 0.05;
  return 1 / p.choices.length;
}

export function bktUpdate(pKnown: number, correct: boolean, params: BktParams, guess: number): number {
  const { slip, learn } = params;
  const post = correct
    ? (pKnown * (1 - slip)) / (pKnown * (1 - slip) + (1 - pKnown) * guess)
    : (pKnown * slip) / (pKnown * slip + (1 - pKnown) * (1 - guess));
  return post + (1 - post) * learn;
}

export function isMastered(s: SkillState): boolean {
  return s.pKnown >= MASTERED_P && (s.attempts >= MASTERED_ATTEMPTS || s.placed);
}
