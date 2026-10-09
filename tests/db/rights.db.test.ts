import { describe, it, expect, beforeAll, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, makeParent } from "../helpers/admin";

const who = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/server/supabase", () => ({ createServerSupabase: async () => who.client }));

import { deleteAccount, deleteKid, exportKid } from "../../src/server/rights";
import { POST as turnPost } from "../../src/app/api/kids/[kidId]/turn/route";
import { POST as answerPost } from "../../src/app/api/kids/[kidId]/answer/route";

const run = Date.now();
const TABLES = ["attempts", "skill_state", "style_stats", "sessions", "distress_flags"] as const;
const ctx = (kidId: string) => ({ params: Promise.resolve({ kidId }) });
const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });
const count = async (table: string, col: string, id: string) =>
  (await admin().from(table).select("*", { count: "exact", head: true }).eq(col, id)).count;

async function kidWithData(p: { userId: string; client: SupabaseClient }, nickname: string): Promise<string> {
  const { data, error } = await p.client.from("kids")
    .insert({ parent_id: p.userId, nickname, grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(error).toBeNull();
  const kid = data.id as string;
  who.client = p.client;
  const t = await (await turnPost(post({}), ctx(kid))).json();
  expect((await answerPost(post({ version: t.version, given: 1 }), ctx(kid))).status).toBe(200);
  const a = admin();
  await a.from("skill_state").upsert({ kid_id: kid, skill_id: "seed-skill", p_known: 0.5, attempts: 1, level: 1,
    correct_streak: 0, wrong_streak: 0, placed: false, recent_tags: [] });
  await a.from("style_stats").upsert({ kid_id: kid, style: "visual", tries: 2, wins: 1 });
  await a.from("distress_flags").insert({ kid_id: kid, line: "I am sad" });
  return kid;
}

let A: { userId: string; client: SupabaseClient };
let B: { userId: string; client: SupabaseClient };

beforeAll(async () => {
  A = await makeParent(`rights-a-${run}@test.dev`, { consent: true });
  B = await makeParent(`rights-b-${run}@test.dev`, { consent: true });
});

describe("data rights", () => {
  it("exportKid returns every table for the parent's own kid and null for another family's", async () => {
    const kid = await kidWithData(A, "Ann");
    const out = await exportKid(A.client, kid);
    expect(out).not.toBeNull();
    expect(out!.kid.nickname).toBe("Ann");
    expect(out!.attempts.length).toBe(1);
    expect(out!.sessions.length).toBeGreaterThan(0);
    expect(out!.skill_state.length).toBeGreaterThan(0);
    expect(out!.style_stats.length).toBe(1);
    expect(out!.distress_flags.map((f) => f.line)).toEqual(["I am sad"]);
    expect(await exportKid(B.client, kid)).toBeNull();
    expect(await exportKid(A.client, "not-a-uuid")).toBeNull();
  });

  it("deleteKid removes the kid and every row, and refuses another family's kid", async () => {
    const kid = await kidWithData(A, "Bo");
    expect(await deleteKid(B.client, kid)).toBe(false);
    expect(await count("kids", "id", kid)).toBe(1);
    expect(await deleteKid(A.client, kid)).toBe(true);
    expect(await count("kids", "id", kid)).toBe(0);
    for (const t of TABLES) expect(await count(t, "kid_id", kid), t).toBe(0);
    expect(await deleteKid(A.client, kid)).toBe(false);
    expect(await deleteKid(A.client, "not-a-uuid")).toBe(false);
  });

  it("deleting a kid mid-session: the old tablet gets 404 from turn and answer, never 500, and nothing remains", async () => {
    const kid = await kidWithData(A, "Cy");
    who.client = A.client;
    const { version } = await (await turnPost(post({}), ctx(kid))).json();
    expect(await deleteKid(A.client, kid)).toBe(true);
    expect((await answerPost(post({ version, given: 1 }), ctx(kid))).status).toBe(404);
    expect((await turnPost(post({}), ctx(kid))).status).toBe(404);
    expect(await count("kids", "id", kid)).toBe(0);
    for (const t of TABLES) expect(await count(t, "kid_id", kid), t).toBe(0);
  });

  it("deleteAccount removes the parent, consents, every kid row and the auth user", async () => {
    const P = await makeParent(`rights-del-${run}@test.dev`, { consent: true });
    await admin().from("consents").insert({ parent_id: P.userId, notice_version: "v1", method: "fake", ref: `r-${run}` });
    await admin().from("report_sends").insert({ parent_id: P.userId, week_start: "2026-10-04" });
    const kid = await kidWithData(P, "Di");
    await deleteAccount(P.userId);
    expect(await count("parents", "id", P.userId)).toBe(0);
    expect(await count("consents", "parent_id", P.userId)).toBe(0);
    expect(await count("report_sends", "parent_id", P.userId)).toBe(0);
    expect(await count("kids", "id", kid)).toBe(0);
    for (const t of TABLES) expect(await count(t, "kid_id", kid), t).toBe(0);
    const { data } = await admin().auth.admin.getUserById(P.userId);
    expect(data.user).toBeNull();
  });
});
