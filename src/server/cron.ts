import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

/** Returns a 401 unless the request carries `Authorization: Bearer ${CRON_SECRET}` (constant-time compare). */
export function requireCronAuth(req: Request): Response | null {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${env.cronSecret()}`);
  if (given.length === want.length && timingSafeEqual(given, want)) return null;
  return new Response("Unauthorized", { status: 401 });
}

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", hourCycle: "h23",
});

/** The weekday, hour and calendar date (YYYY-MM-DD) in New York at an instant; daylight saving handled by Intl. */
export function easternSlot(now: Date): { weekday: string; hour: number; date: string } {
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { weekday: p.weekday!, hour: Number(p.hour), date: `${p.year}-${p.month}-${p.day}` };
}
