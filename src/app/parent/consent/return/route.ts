import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { requireParent } from "@/server/parentGate";
import { getConsentGateway } from "@/server/consent/gateway";
import { PRIVACY_NOTICE_VERSION } from "@/server/consent/notice";
import { env } from "@/server/env";

// Stripe sends the parent back in the same browser, so the PIN cookie is still there: requireParent is fine.
export async function GET(req: NextRequest) {
  const { user } = await requireParent();
  const to = (path: string) => NextResponse.redirect(new URL(path, env.appOrigin()));
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  const fail = () => to("/parent/consent?error=1");
  if (!sessionId) return fail();

  let verdict;
  try {
    verdict = await getConsentGateway().verify(sessionId);
  } catch {
    return fail();
  }
  if (!verdict.ok || verdict.parentId !== user.id) return fail();

  // consents has no user policies; only the secret key may call grant_consent. Scoped to the confirmed user's id.
  const db = createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.rpc("grant_consent", {
    p_parent: user.id,
    p_notice: PRIVACY_NOTICE_VERSION,
    p_method: verdict.method,
    p_ref: verdict.ref,
  });
  if (error) return fail();
  return to("/parent?consented=1");
}
