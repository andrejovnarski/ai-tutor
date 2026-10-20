import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export function admin(): SupabaseClient {
  return createClient(url(), process.env.SUPABASE_SECRET_KEY!, opts);
}

export function anon(): SupabaseClient {
  return createClient(url(), publishable(), opts);
}

export async function makeParent(
  email: string,
  { consent = false }: { consent?: boolean } = {},
): Promise<{ userId: string; client: SupabaseClient }> {
  const a = admin();
  const { data, error } = await a.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const userId = data.user.id;
  if (consent) {
    const { error: e } = await a.from("parents").update({ consent_at: new Date().toISOString() }).eq("id", userId);
    if (e) throw e;
  }
  const client = anon();
  const { error: ve } = await client.auth.verifyOtp({
    type: data.properties.verification_type as "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (ve) throw ve;
  return { userId, client };
}

const MAILPIT = "http://127.0.0.1:54324/api/v1";

/** Mailpit's list endpoint returns only the newest 50, so by-address lookups use the search API (newest first). */
async function searchTo(email: string, extra = ""): Promise<{ ID: string }[]> {
  const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}" ${extra}`.trim())}`);
  return ((await res.json()) as { messages: { ID: string }[] }).messages;
}

/** Number of messages Mailpit holds for an address; `extra` is more Mailpit search terms, e.g. `subject:"x"`. */
export async function mailCountTo(email: string, extra = ""): Promise<number> {
  return (await searchTo(email, extra)).length;
}

export async function latestEmailLink(email: string): Promise<string> {
  const full = await latestEmailTo(email);
  const m = /https?:\/\/[^\s"'<>]*\/auth\/confirm[^\s"'<>]*/.exec(full.HTML + " " + full.Text);
  if (!m) throw new Error("no confirm link in mail");
  return m[0].replace(/&amp;/g, "&");
}

/** Polls Mailpit for the newest message to an address for up to about 15 seconds. */
export async function latestEmailTo(email: string): Promise<{ Subject: string; Text: string; HTML: string }> {
  for (let i = 0; i < 75; i++) {
    const [msg] = await searchTo(email);
    if (msg) return (await fetch(`${MAILPIT}/message/${msg.ID}`)).json();
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no mail for ${email}`);
}
