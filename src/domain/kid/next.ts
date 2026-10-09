import { SKILLS, getSkill } from "../curriculum/index";
import { isMastered } from "./bkt";
import type { KidState, SkillState } from "./types";

const mastered = (kid: KidState, id: string) => isMastered(kid.skills[id]!);

/** First skill in curriculum order that is not mastered but whose needs all are. */
export function frontier(kid: KidState): string | null {
  const s = SKILLS.find((sk) => !mastered(kid, sk.id) && sk.needs.every((n) => mastered(kid, n)));
  return s?.id ?? null;
}

/** Mastered skill seen longest ago (never seen counts as oldest); ties go to curriculum order. */
export function reviewTarget(kid: KidState, exclude: string | null): string | null {
  let best: SkillState | null = null;
  for (const sk of SKILLS) {
    const s = kid.skills[sk.id]!;
    if (sk.id === exclude || !isMastered(s)) continue;
    if (!best || (s.lastSeen ?? -Infinity) < (best.lastSeen ?? -Infinity)) best = s;
  }
  return best?.skillId ?? null;
}

/** Easiest mastered skill of `near`'s grade (so older kids don't get kindergarten work); else the earliest mastered. */
export function easyReview(kid: KidState, near: string | null = null): string | null {
  const grade = near ? getSkill(near).grade : null;
  const sameGrade = SKILLS.find((sk) => sk.grade === grade && mastered(kid, sk.id));
  return (sameGrade ?? SKILLS.find((sk) => mastered(kid, sk.id)))?.id ?? null;
}

/** The need the kid knows least; ties go to curriculum order. */
export function weakestPrereq(kid: KidState, skillId: string): string | null {
  const needs = new Set(getSkill(skillId).needs);
  let best: string | null = null;
  for (const sk of SKILLS) {
    if (!needs.has(sk.id)) continue;
    if (best === null || kid.skills[sk.id]!.pKnown < kid.skills[best]!.pKnown) best = sk.id;
  }
  return best;
}

export function isStruggling(s: SkillState): boolean {
  if (s.level === 1 && s.wrongStreak >= 2) return true;
  const tags = s.recentTags.filter((t) => t !== null);
  return tags.some((t, i) => tags.indexOf(t) !== i);
}
