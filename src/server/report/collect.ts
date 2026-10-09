import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSkill } from "../../domain/curriculum";
import { frontier } from "../../domain/kid/next";
import { MISTAKE_TAGS, type MistakeTag } from "../../domain/types";
import { kidStateFromRows, type KidRow, type SkillRow } from "../persist/rows";
import { TAG_LABEL } from "./tips";
import type { KidWeek } from "./build";

type A = { session_id: string; mistake_tag: MistakeTag | null; time_ms: number; at: string };
const PAGE = 1000;

async function attemptsIn(db: SupabaseClient, kidId: string, from: Date, to: Date): Promise<A[]> {
  const out: A[] = [];
  for (let i = 0; ; i += PAGE) {
    const { data, error } = await db.from("attempts").select("session_id, mistake_tag, time_ms, at")
      .eq("kid_id", kidId).gte("at", from.toISOString()).lt("at", to.toISOString()).order("at").order("id")
      .range(i, i + PAGE - 1);
    if (error) throw error;
    out.push(...(data as A[]));
    if (data.length < PAGE) return out;
  }
}

/** Whole minutes: per session, last attempt minus first attempt plus the last attempt's own time. */
function minutesOf(attempts: A[]): number {
  const bySession = new Map<string, A[]>();
  for (const a of attempts) bySession.set(a.session_id, [...(bySession.get(a.session_id) ?? []), a]);
  let ms = 0;
  for (const list of bySession.values()) {
    const at = list.map((a) => Date.parse(a.at));
    ms += Math.max(...at) - Math.min(...at) + list.reduce((last, a) => (Date.parse(a.at) >= Date.parse(last.at) ? a : last)).time_ms;
  }
  return Math.round(ms / 60_000);
}

function stuckOf(attempts: A[]): string[] {
  const counts = new Map<MistakeTag, number>();
  for (const a of attempts) if (a.mistake_tag) counts.set(a.mistake_tag, (counts.get(a.mistake_tag) ?? 0) + 1);
  return [...counts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || MISTAKE_TAGS.indexOf(a[0]) - MISTAKE_TAGS.indexOf(b[0]))
    .slice(0, 2)
    .map(([tag]) => TAG_LABEL[tag]);
}

const nameOf = (id: string) => { try { return getSkill(id).name; } catch { return null; } };

export async function collectWeek(db: SupabaseClient, parentId: string, from: Date, to: Date): Promise<KidWeek[]> {
  const { data: kids, error } = await db.from("kids").select("id, nickname, grade, age_band, placed")
    .eq("parent_id", parentId).order("created_at");
  if (error) throw error;
  const weeks: KidWeek[] = [];
  for (const k of kids as (KidRow & { nickname: string })[]) {
    const attempts = await attemptsIn(db, k.id, from, to);
    const { data: skills, error: se } = await db.from("skill_state").select("*").eq("kid_id", k.id);
    if (se) throw se;
    const rows = skills as (SkillRow & { mastered_at: string | null })[];
    const mastered = rows
      .filter((r) => r.mastered_at && Date.parse(r.mastered_at) >= from.getTime() && Date.parse(r.mastered_at) < to.getTime())
      .map((r) => nameOf(r.skill_id))
      .filter((n): n is string => n !== null);
    const current = frontier(kidStateFromRows(k, rows, []));
    weeks.push({
      nickname: k.nickname,
      sessions: new Set(attempts.map((a) => a.session_id)).size,
      minutes: minutesOf(attempts),
      mastered,
      currentSkill: current ? nameOf(current) : null,
      stuck: stuckOf(attempts),
    });
  }
  return weeks;
}
