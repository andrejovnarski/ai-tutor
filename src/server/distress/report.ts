import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";
import { getMailer } from "../email/mailer";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const NOTICE = "Math Friend is not a crisis service. If your child may be in danger, call 911. For a mental health crisis, call or text 988.";

const db = () =>
  createClient(env.supabaseUrl(), env.supabaseSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });

type Flag = { id: number; kid_id: string; line: string; at: string };

/** Emails the parent about one stored flag, then marks it sent. Throws on any failure (the flag stays unsent). */
async function deliver(c: ReturnType<typeof db>, f: Flag): Promise<void> {
  const { data: kid, error: ke } = await c.from("kids").select("nickname, parent_id").eq("id", f.kid_id).single();
  if (ke) throw ke;
  const { data: u, error: ue } = await c.auth.admin.getUserById(kid.parent_id);
  if (ue) throw ue;
  const to = u.user?.email;
  if (!to) throw new Error("parent has no email");

  const when = new Date(f.at).toUTCString();
  const intro = `${kid.nickname} said something that may mean they are having a hard time.`;
  await getMailer().send({
    to,
    subject: `${kid.nickname} said something that worried us`,
    text: `${intro}\n\nWhat they said: "${f.line}"\nWhen: ${when}\n\n${NOTICE}`,
    html: `<p>${esc(intro)}</p><p>What they said: &ldquo;${esc(f.line)}&rdquo;<br>When: ${esc(when)}</p><p>${NOTICE}</p>`,
  });
  const { error } = await c.from("distress_flags").update({ emailed_at: new Date().toISOString() }).eq("id", f.id);
  if (error) throw error;
}

/**
 * Stores the flagged line, then emails the parent at once. The caller must already have confirmed (with the caller's own
 * client) that the signed-in parent owns the kid. Only a failure to store throws; a failed email is logged (by flag id,
 * never the text) and the flag stays unsent for sendPendingDistressEmails to retry.
 */
export async function reportDistress(kidId: string, line: string, now: number): Promise<void> {
  const c = db();
  const { data, error } = await c
    .from("distress_flags")
    .insert({ kid_id: kidId, line: line.slice(0, 500), at: new Date(now).toISOString() })
    .select("id, kid_id, line, at")
    .single();
  if (error) throw error;
  try {
    await deliver(c, data as Flag);
  } catch (err) {
    console.error(`distress email failed for flag ${data.id}`, err);
  }
}

/** Retries every unsent flag, oldest first. Run by the daily cron. */
export async function sendPendingDistressEmails(): Promise<{ sent: number }> {
  const c = db();
  const { data, error } = await c
    .from("distress_flags").select("id, kid_id, line, at").is("emailed_at", null).order("at", { ascending: true });
  if (error) throw error;
  let sent = 0;
  for (const f of data as Flag[]) {
    try {
      await deliver(c, f);
      sent++;
    } catch (err) {
      console.error(`distress email failed for flag ${f.id}`, err);
    }
  }
  return { sent };
}
