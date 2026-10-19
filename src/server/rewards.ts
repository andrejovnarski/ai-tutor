import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { endRewards, progress, type EndRewards, type MasteredAt, type Progress, type SessionFacts } from "../domain/rewards/progress";
import { env } from "./env";

export type RewardRows = { sessions: SessionFacts[]; masteredAt: MasteredAt };

type SessionRow = {
  started_at: string; ended_at: string | null;
  problems: unknown; firstTryCorrect: unknown; mastered: unknown; lastActivity: unknown;
};
type SkillRow = { skill_id: string; mastered_at: string };

/** Reads only the fields rewards need (never attempts or nicknames) with the caller's client, so RLS applies. Throws on a query error. */
export async function loadRewardRows(db: SupabaseClient, kidId: string): Promise<RewardRows> {
  const [s, k] = await Promise.all([
    db.from("sessions")
      .select("started_at, ended_at, problems:state->problems, firstTryCorrect:state->firstTryCorrect, mastered:state->mastered, lastActivity:state->lastActivity")
      .eq("kid_id", kidId).not("ended_at", "is", null),
    db.from("skill_state").select("skill_id, mastered_at").eq("kid_id", kidId).not("mastered_at", "is", null),
  ]);
  if (s.error) throw s.error;
  if (k.error) throw k.error;
  const sessions = ((s.data ?? []) as unknown as SessionRow[]).map((r): SessionFacts => {
    const startedAt = Date.parse(r.started_at);
    const endedAt = r.ended_at ? Date.parse(r.ended_at) : null;
    return {
      startedAt, endedAt,
      // Stored as a number of ms; a missing one falls back to the end time (progress treats NaN as unusable).
      lastActivity: typeof r.lastActivity === "number" ? r.lastActivity : (endedAt ?? startedAt),
      problems: r.problems as number, firstTryCorrect: r.firstTryCorrect as number, mastered: r.mastered as string[],
    };
  });
  const masteredAt: MasteredAt = {};
  for (const r of (k.data ?? []) as SkillRow[]) masteredAt[r.skill_id] = Date.parse(r.mastered_at);
  return { sessions, masteredAt };
}

async function guarded<T>(
  db: SupabaseClient, kidId: string, f: (rows: RewardRows) => T,
): Promise<T | null> {
  if (env.rewards() === "off") return null;
  try {
    return f(await loadRewardRows(db, kidId));
  } catch {
    console.error("rewards failed for kid", kidId); // the id only: no error object, it may echo row data
    return null;
  }
}

export const kidProgress = (db: SupabaseClient, kidId: string, now: number): Promise<Progress | null> =>
  guarded(db, kidId, (r) => progress(r.sessions, r.masteredAt, now));

export const kidEndRewards = (db: SupabaseClient, kidId: string, now: number): Promise<EndRewards | null> =>
  guarded(db, kidId, (r) => endRewards(r.sessions, r.masteredAt, now));
