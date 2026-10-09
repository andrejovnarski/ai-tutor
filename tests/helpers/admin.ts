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

export async function latestEmailLink(email: string): Promise<string> {
  const base = "http://127.0.0.1:54324/api/v1";
  type Summary = { ID: string; Created: string; To: { Address: string }[] };
  let msg: Summary | undefined;
  for (let i = 0; i < 10 && !msg; i++) {
    const list = (await (await fetch(`${base}/messages`)).json()) as { messages: Summary[] };
    msg = list.messages
      .filter((m) => m.To.some((t) => t.Address === email))
      .sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created))[0];
    if (!msg) await new Promise((r) => setTimeout(r, 200));
  }
  if (!msg) throw new Error(`no mail for ${email}`);
  const full = await (await fetch(`${base}/message/${msg.ID}`)).json();
  const m = /https?:\/\/[^\s"'<>]*\/auth\/confirm[^\s"'<>]*/.exec(full.HTML + " " + full.Text);
  if (!m) throw new Error("no confirm link in mail");
  return m[0].replace(/&amp;/g, "&");
}
