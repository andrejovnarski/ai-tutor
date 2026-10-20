import { SKILLS } from "../curriculum/index";
import type { AgeBand, Level, MistakeTag, Style } from "../types";
import { bktParams, bktUpdate } from "./bkt";
import type { KidGrade, KidState, SkillState, StyleStat } from "./types";

const STYLES: Style[] = ["number-line", "blocks", "ten-frame", "story", "drawing"];
const RECENT = 4;

export function newKidState(kidId: string, ageBand: AgeBand, grade: KidGrade): KidState {
  const skills: Record<string, SkillState> = {};
  for (const s of SKILLS) {
    skills[s.id] = {
      skillId: s.id, pKnown: bktParams(s.id).prior, attempts: 0, level: 1,
      correctStreak: 0, wrongStreak: 0, lastSeen: null, placed: false, recentTags: [], checkStep: 0, checkDue: null, rememberedAt: null,
    };
  }
  const styles = Object.fromEntries(STYLES.map((style) => [style, { style, tries: 0, wins: 0 }])) as Record<Style, StyleStat>;
  return { kidId, ageBand, grade, placed: false, skills, styles };
}

/** Updates a skill after the first try at a problem: BKT, attempts, tags, then the level rule. */
export function applyFirstTry(
  s: SkillState,
  o: { correct: boolean; tag: MistakeTag | null; guess: number; now: number },
): SkillState {
  const next: SkillState = {
    ...s,
    pKnown: bktUpdate(s.pKnown, o.correct, bktParams(s.skillId), o.guess),
    attempts: s.attempts + 1,
    lastSeen: o.now,
    recentTags: [...s.recentTags, o.correct ? null : o.tag].slice(-RECENT),
    correctStreak: o.correct ? s.correctStreak + 1 : 0,
    wrongStreak: o.correct ? 0 : s.wrongStreak + 1,
  };
  if (next.correctStreak >= 3) {
    return { ...next, level: Math.min(3, next.level + 1) as Level, correctStreak: 0, wrongStreak: 0 };
  }
  if (next.wrongStreak >= 2 && next.level > 1) {
    return { ...next, level: (next.level - 1) as Level, correctStreak: 0, wrongStreak: 0 };
  }
  return next;
}

export function resetStruggle(s: SkillState): SkillState {
  return { ...s, wrongStreak: 0, recentTags: [] };
}
