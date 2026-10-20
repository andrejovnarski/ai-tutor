// First-session placement: step-capped binary search along the skill chain (spec §6).
import { SKILLS } from "../curriculum/index";
import type { Level } from "../types";
import type { KidGrade, KidState } from "./types";

export type PlacementState = { lo: number; hi: number; mid: number; probes: number; inProbe: number; probeOk: boolean };

export const PLACEMENT_PROBES = 5;
export const PROBE_SIZE = 2;
export const MAX_STEP = 6;
export const PROBE_LEVEL: Level = 2;
const PLACED_P = 0.95;

const firstOfGrade = (g: "K" | "1" | "2") => SKILLS.findIndex((s) => s.grade === g);

export function startPlacement(grade: KidGrade): PlacementState {
  const g = grade === "K" || grade === "1" ? grade : "2";
  return { lo: 0, hi: SKILLS.length - 1, mid: firstOfGrade(g), probes: 0, inProbe: 0, probeOk: true };
}

const done = (p: PlacementState) => p.probes >= PLACEMENT_PROBES || p.lo > p.hi;

export function placementProbe(p: PlacementState): { skillId: string; level: Level } | null {
  return done(p) ? null : { skillId: SKILLS[p.mid]!.id, level: PROBE_LEVEL };
}

export function recordPlacement(p: PlacementState, correct: boolean): PlacementState {
  if (done(p)) return p;
  const inProbe = p.inProbe + 1;
  const probeOk = p.probeOk && correct;
  if (inProbe < PROBE_SIZE) return { ...p, inProbe, probeOk };
  const lo = probeOk ? p.mid + 1 : p.lo;
  const hi = probeOk ? p.hi : p.mid - 1;
  const mid = Math.max(lo, p.mid - MAX_STEP, Math.min(hi, p.mid + MAX_STEP, Math.floor((lo + hi) / 2)));
  return { lo, hi, mid, probes: p.probes + 1, inProbe: 0, probeOk: true };
}

/** Skills below the found point count as mastered by placement. */
export function finishPlacement(kid: KidState, p: PlacementState): KidState {
  const skills = { ...kid.skills };
  SKILLS.slice(0, p.lo).forEach((s) => {
    skills[s.id] = { ...skills[s.id]!, pKnown: PLACED_P, placed: true, level: 2 };
  });
  return { ...kid, skills, placed: true };
}
