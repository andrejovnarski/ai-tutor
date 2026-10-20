import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { endRewards, progress, type EndRewards, type MasteredAt, type Progress, type SessionFacts } from "../domain/rewards/progress";
import { env } from "./env";

export type RewardRows = { sessions: SessionFacts[]; masteredAt: MasteredAt; placed: string[] };

type SessionRow = {
  started_at: string; ended_at: string | null;
  problems: unknown; firstTryCorrect: unknown; mastered: unknown; lastActivity: unknown;
};
type SkillRow = { skill_id: string; mastered_at: string | null; placed: boolean };

/** Rewards are extra: a read slower than this is dropped rather than holding up the page. */
const TIMEOUT_MS = 1500;

/**
 * Reads only the fields rewards need (never attempts or nicknames) with the caller's client, so RLS applies.
 * Throws on a query error, including a read that takes longer than `timeoutMs`.
 */
export async function loadRewardRows(db: SupabaseClient, kidId: string, timeoutMs = TIMEOUT_MS): Promise<RewardRows> {
  const [s, k] = await Promise.all([
    db.from("sessions")
      .select("started_at, ended_at, problems:state->problems, firstTryCorrect:state->firstTryCorrect, mastered:state->mastered, lastActivity:state->lastActivity")
      .eq("kid_id", kidId).not("ended_at", "is", null)
      .abortSignal(AbortSignal.timeout(timeoutMs)),
    db.from("skill_state").select("skill_id, mastered_at, placed").eq("kid_id", kidId).or("mastered_at.not.is.null,placed.eq.true")
      .abortSignal(AbortSignal.timeout(timeoutMs)),
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
  const placed: string[] = [];
  for (const r of (k.data ?? []) as SkillRow[]) {
    if (r.mastered_at != null) masteredAt[r.skill_id] = Date.parse(r.mastered_at);
    if (r.placed) placed.push(r.skill_id);
  }
  return { sessions, masteredAt, placed };
}

async function guarded<T>(
  db: SupabaseClient, kidId: string, f: (rows: RewardRows) => T, timeoutMs?: number,
): Promise<T | null> {
  if (env.rewards() === "off") return null;
  try {
    return f(await loadRewardRows(db, kidId, timeoutMs));
  } catch {
    console.error("rewards failed for kid", kidId); // the id only: no error object, it may echo row data
    return null;
  }
}

export const kidProgress = (db: SupabaseClient, kidId: string, now: number, timeoutMs?: number): Promise<Progress | null> =>
  guarded(db, kidId, (r) => progress(r.sessions, r.masteredAt, now, new Set(r.placed)), timeoutMs);

export const kidEndRewards = (db: SupabaseClient, kidId: string, now: number, timeoutMs?: number): Promise<EndRewards | null> =>
  guarded(db, kidId, (r) => endRewards(r.sessions, r.masteredAt, now, new Set(r.placed)), timeoutMs);
