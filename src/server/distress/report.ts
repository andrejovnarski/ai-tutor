import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";
import { getMailer } from "../email/mailer";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const NOTICE = "Math Friend is not a crisis service. If your child may be in danger, call 911. For a mental health crisis, call or text 988.";

/**
 * Stores the flagged line and emails the parent at once. The caller must already have confirmed (with the caller's own
 * client) that the signed-in parent owns the kid. If the email fails the row is kept and the error is rethrown.
 */
export async function reportDistress(kidId: string, line: string, now: number): Promise<void> {
  const db = createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const kept = line.slice(0, 500);
  const { error } = await db.from("distress_flags").insert({ kid_id: kidId, line: kept, at: new Date(now).toISOString() });
  if (error) throw error;

  const { data: kid, error: ke } = await db.from("kids").select("nickname, parent_id").eq("id", kidId).single();
  if (ke) throw ke;
  const { data: u, error: ue } = await db.auth.admin.getUserById(kid.parent_id);
  if (ue) throw ue;
  const to = u.user?.email;
  if (!to) throw new Error("parent has no email");

  const when = new Date(now).toUTCString();
  const intro = `${kid.nickname} said something that may mean they are having a hard time.`;
  await getMailer().send({
    to,
    subject: `${kid.nickname} said something that worried us`,
    text: `${intro}\n\nWhat they said: "${kept}"\nWhen: ${when}\n\n${NOTICE}`,
    html: `<p>${esc(intro)}</p><p>What they said: &ldquo;${esc(kept)}&rdquo;<br>When: ${esc(when)}</p><p>${NOTICE}</p>`,
  });
}
