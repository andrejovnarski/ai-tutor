import { requireCronAuth } from "@/server/cron";
import { runRetention } from "@/server/retention";

export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;
  // The `now` override exists for tests and is ignored in production.
  const override = process.env.VERCEL_ENV === "production" ? null : new URL(req.url).searchParams.get("now");
  const now = override === null ? new Date() : new Date(Number(override));
  if (Number.isNaN(now.getTime())) return new Response("Bad now", { status: 400 });
  return Response.json(await runRetention(now));
}
