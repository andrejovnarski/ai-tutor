import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

type Row = Record<string, unknown>;
export type KidExport = {
  kid: { id: string; nickname: string; grade: string; age_band: string; avatar: string; placed: boolean; created_at: string };
  skill_state: Row[];
  style_stats: Row[];
  attempts: Row[];
  sessions: Row[];
  distress_flags: { id: number; line: string; at: string; emailed_at: string | null }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Everything stored about one kid, read through the parent's own client (RLS). Null when the kid is not theirs. */
export async function exportKid(db: SupabaseClient, kidId: string): Promise<KidExport | null> {
  if (!UUID.test(kidId)) return null;
  const { data: kid, error } = await db.from("kids").select("*").eq("id", kidId).maybeSingle();
  if (error) throw error;
  if (!kid) return null;
  const rows = async (table: string, order: string): Promise<Row[]> => {
    const { data, error: e } = await db.from(table).select("*").eq("kid_id", kidId).order(order);
    if (e) throw e;
    return data ?? [];
  };
  const [skill_state, style_stats, attempts, sessions, distress_flags] = await Promise.all([
    rows("skill_state", "skill_id"),
    rows("style_stats", "style"),
    rows("attempts", "id"),
    rows("sessions", "started_at"),
    rows("distress_flags", "id"),
  ]);
  return { kid, skill_state, style_stats, attempts, sessions, distress_flags } as KidExport;
}

/** Deletes the kid through the parent's client; RLS limits it to their own kids and the cascades remove every row. */
export async function deleteKid(db: SupabaseClient, kidId: string): Promise<boolean> {
  if (!UUID.test(kidId)) return false;
  const { data, error } = await db.from("kids").delete().eq("id", kidId).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Deletes the auth user; cascades remove parents, kids, consents, report_sends and all kid data. */
export async function deleteAccount(userId: string): Promise<void> {
  const admin = createClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
