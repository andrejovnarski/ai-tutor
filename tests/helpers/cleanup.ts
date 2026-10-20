import { createClient } from "@supabase/supabase-js";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/**
 * Deletes every leftover test user whose email ends with the supplied suffix so crons that scan all parents stay fast. Other users are
 * untouched. Refuses to run against anything but the local Supabase stack.
 */
export async function deleteTestUsers(suffix: string, env: Record<string, string | undefined> = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  let host = "";
  try {
    host = new URL(url ?? "").hostname;
  } catch {
    // not a URL: refused below
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`test cleanup runs only against the local Supabase stack (127.0.0.1 or localhost), not ${JSON.stringify(url)}`);
  }
  const a = createClient(url!, env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const remove = async (ids: string[]) => {
    for (const id of ids) {
      const { error } = await a.auth.admin.deleteUser(id);
      if (error) throw error; // never loop on a user that cannot be deleted
    }
  };
  for (;;) {
    // Always page 1: deleting shifts later users forward; stop when a page holds no test users.
    const { data, error } = await a.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    const mine = data.users.filter((u) => u.email?.endsWith(suffix));
    if (!mine.length) {
      if (data.users.length < 200) return;
      // page 1 is all non-test users: walk later pages
      for (let page = 2; ; page++) {
        const r = await a.auth.admin.listUsers({ page, perPage: 200 });
        if (r.error) throw r.error;
        const found = r.data.users.filter((u) => u.email?.endsWith(suffix));
        await remove(found.map((u) => u.id));
        if (found.length) break; // restart from page 1
        if (r.data.users.length < 200) return;
      }
      continue;
    }
    await remove(mine.map((u) => u.id));
  }
}
