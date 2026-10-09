import "server-only";
import { createClient } from "@supabase/supabase-js";
import { easternSlot } from "../cron";
import { getMailer } from "../email/mailer";
import { env } from "../env";
import { buildWeeklyReport } from "./build";
import { collectWeek } from "./collect";

const DAY = 86_400_000;
const PG_UNIQUE_VIOLATION = "23505";

/** Date (YYYY-MM-DD) a number of days before a YYYY-MM-DD date. */
const minusDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) - n * DAY).toISOString().slice(0, 10);

/**
 * Runs hourly on Sundays (UTC); sends only at 17:00 Sunday in New York. The window is the 7 days before `now`.
 * `report_sends(parent_id, week_start)` is claimed before sending, so overlapping or repeated runs send once.
 */
export async function sendWeeklyReports(now: Date): Promise<{ sent: number }> {
  const slot = easternSlot(now);
  if (slot.weekday !== "Sun" || slot.hour !== 17) return { sent: 0 };
  const weekStart = minusDays(slot.date, 7);
  const from = new Date(now.getTime() - 7 * DAY);

  const db = createClient(env.supabaseUrl(), env.supabaseSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: parents, error } = await db.from("parents").select("id, kids!inner(id)").not("consent_at", "is", null);
  if (error) throw error;

  let sent = 0;
  for (const { id } of parents) {
    const claim = await db.from("report_sends").insert({ parent_id: id, week_start: weekStart });
    if (claim.error) {
      if (claim.error.code === PG_UNIQUE_VIOLATION) continue;
      throw claim.error;
    }
    try {
      const { data: user, error: ue } = await db.auth.admin.getUserById(id);
      const to = user?.user?.email;
      if (ue || !to) throw ue ?? new Error("parent has no email");
      const mail = buildWeeklyReport(await collectWeek(db, id, from, now), weekStart);
      await getMailer().send({ to, ...mail });
      sent++;
    } catch (e) {
      // Release the claim so the next hourly run retries; one parent's failure must not stop the others.
      await db.from("report_sends").delete().eq("parent_id", id).eq("week_start", weekStart);
      console.error("weekly report failed", id, e instanceof Error ? e.message : e);
    }
  }
  return { sent };
}
