import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KidRow } from "./persist/rows";
import type { KidWeek } from "./report/build";
import { collectKid, nyDate, nyMidnightDaysAgo } from "./report/collect";

const TZ = "America/New_York";
const ymd = nyDate;
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" });
const monthDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });
const DAY = 86_400_000;

export function lastPlayedLabel(last: Date | null, now: Date): string {
  if (!last) return "hasn't played yet";
  const days = Math.round((Date.parse(ymd.format(now)) - Date.parse(ymd.format(last))) / DAY);
  if (days <= 0) return "played today";
  if (days === 1) return "played yesterday";
  if (days < 7) return `played on ${weekday.format(last)}`;
  return `played on ${monthDay.format(last)}`;
}

/** Newest attempt per kid; kids with none are absent. One indexed limit(1) query per kid, in parallel. */
export async function lastPlayed(db: SupabaseClient, kidIds: string[]): Promise<Map<string, Date>> {
  const found = await Promise.all(kidIds.map(async (id) => {
    const { data, error } = await db.from("attempts").select("at").eq("kid_id", id)
      .order("at", { ascending: false }).limit(1);
    if (error) throw error;
    return [id, data[0] ? new Date((data[0] as { at: string }).at) : null] as const;
  }));
  const out = new Map<string, Date>();
  for (const [id, at] of found) if (at) out.set(id, at);
  return out;
}

/** Exactly 7 New York dates: today and the 6 before it. */
export async function kidWeek(
  db: SupabaseClient, kidId: string, now: Date,
): Promise<{ week: KidWeek; playedDays: string[] } | null> {
  const { data, error } = await db.from("kids").select("id, nickname, grade, age_band, placed")
    .eq("id", kidId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return collectKid(db, data as KidRow & { nickname: string }, nyMidnightDaysAgo(now, 6), now);
}
