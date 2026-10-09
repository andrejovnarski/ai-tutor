import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

/** Deletes every leftover test user (email ending @test.dev) so crons that scan all parents stay fast. Other users are untouched. */
export default async function setup() {
  const env = loadEnv("test", process.cwd(), "");
  const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  for (;;) {
    // Always page 1: deleting shifts later users forward; stop when a page holds no test users.
    const { data, error } = await a.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const mine = data.users.filter((u) => u.email?.endsWith("@test.dev"));
    if (!mine.length) {
      if (data.users.length < 200) return;
      // page 1 is all non-test users: walk later pages
      for (let page = 2; ; page++) {
        const r = await a.auth.admin.listUsers({ page, perPage: 200 });
        if (r.error) throw r.error;
        const found = r.data.users.filter((u) => u.email?.endsWith("@test.dev"));
        for (const u of found) await a.auth.admin.deleteUser(u.id);
        if (found.length) break; // restart from page 1
        if (r.data.users.length < 200) return;
      }
      continue;
    }
    for (const u of mine) {
      const { error: de } = await a.auth.admin.deleteUser(u.id);
      if (de) throw de;
    }
  }
}
