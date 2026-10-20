// Row shapes mirror supabase/migrations/0001_init.sql (snake_case); mappers are pure.
import { newKidState } from "../../domain/kid/state";
import type { Attempt, KidGrade, KidState, SkillState, StyleStat } from "../../domain/kid/types";
import type { AgeBand, Level, MistakeTag, Style } from "../../domain/types";

export type KidRow = { id: string; grade: KidGrade; age_band: AgeBand; placed: boolean };
export type SkillRow = {
  kid_id: string; skill_id: string; p_known: number; attempts: number; level: Level;
  correct_streak: number; wrong_streak: number; last_seen: string | null; placed: boolean;
  recent_tags: (MistakeTag | null)[];
  check_step?: SkillState["checkStep"]; check_due?: string | null; remembered_at?: string | null;
};
export type StyleRow = { kid_id: string; style: Style; tries: number; wins: number };
export type AttemptRow = {
  kid_id: string; session_id: string; skill_id: string; template_id: string; seed: number; level: Level;
  answer: Attempt["answer"]; result: Attempt["result"]; mistake_tag: MistakeTag | null; style: Style | null;
  time_ms: number; at: string; try: 1 | 2; mode: Attempt["mode"];
};

export function kidStateFromRows(kid: KidRow, skills: SkillRow[], styles: StyleRow[]): KidState {
  const state = newKidState(kid.id, kid.age_band, kid.grade);
  state.placed = kid.placed;
  for (const r of skills) {
    state.skills[r.skill_id] = {
      checkStep: r.check_step ?? 0, checkDue: r.check_due == null ? null : Date.parse(r.check_due),
      rememberedAt: r.remembered_at == null ? null : Date.parse(r.remembered_at),
      skillId: r.skill_id, pKnown: r.p_known, attempts: r.attempts, level: r.level,
      correctStreak: r.correct_streak, wrongStreak: r.wrong_streak,
      lastSeen: r.last_seen === null ? null : Date.parse(r.last_seen), placed: r.placed, recentTags: r.recent_tags,
    };
  }
  for (const r of styles) state.styles[r.style] = { style: r.style, tries: r.tries, wins: r.wins };
  return state;
}

export const skillRow = (kidId: string, s: SkillState): SkillRow => ({
  check_step: s.checkStep ?? 0, check_due: s.checkDue == null ? null : new Date(s.checkDue).toISOString(),
  remembered_at: s.rememberedAt == null ? null : new Date(s.rememberedAt).toISOString(),
  kid_id: kidId, skill_id: s.skillId, p_known: s.pKnown, attempts: s.attempts, level: s.level,
  correct_streak: s.correctStreak, wrong_streak: s.wrongStreak,
  last_seen: s.lastSeen === null ? null : new Date(s.lastSeen).toISOString(), placed: s.placed, recent_tags: s.recentTags,
});

export const styleRow = (kidId: string, s: StyleStat): StyleRow => ({ kid_id: kidId, style: s.style, tries: s.tries, wins: s.wins });

export const attemptRow = (sessionId: string, a: Attempt): AttemptRow => ({
  kid_id: a.kidId, session_id: sessionId, skill_id: a.skillId, template_id: a.templateId, seed: a.seed, level: a.level,
  answer: a.answer, result: a.result, mistake_tag: a.mistakeTag, style: a.style, time_ms: a.timeMs,
  at: new Date(a.at).toISOString(), try: a.try, mode: a.mode,
});
