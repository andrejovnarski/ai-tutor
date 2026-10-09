import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, makeParent } from "../helpers/admin";

const run = Date.now();
const kidRow = (parent_id: string, nickname = "Kit") => ({ parent_id, nickname, grade: "2", age_band: "5-7", avatar: "fox" });
const attempt = (kid_id: string, session_id: string, at: string) => ({
  kid_id, session_id, skill_id: "add", template_id: "t", seed: 1, level: 1, answer: 2, result: "correct",
  mistake_tag: null, style: null, time_ms: 10, at, try: 1, mode: "practice",
});
const skill = (kid_id: string) => ({ kid_id, skill_id: "add", p_known: 0.5, attempts: 1, level: 1, correct_streak: 0, wrong_streak: 0, last_seen: null, placed: false, recent_tags: [] });
const save = (c: SupabaseClient, session: string, version: number, o: { ended?: boolean; attempts?: unknown[]; skills?: unknown[]; styles?: unknown[] } = {}) =>
  c.rpc("save_step", {
    p_session: session, p_version: version, p_state: {}, p_ended: o.ended ?? false,
    p_attempts: o.attempts ?? [], p_skill_states: o.skills ?? [], p_style_stats: o.styles ?? [], p_kid_placed: false,
  });

let A: { userId: string; client: SupabaseClient };
let B: { userId: string; client: SupabaseClient };
let kidX: string;

const newKid = async (c: { userId: string; client: SupabaseClient }, name: string) =>
  (await c.client.from("kids").insert(kidRow(c.userId, name)).select().single()).data!.id as string;
const newSession = async (kid: string) => {
  const { data, error } = await admin().from("sessions").insert({ kid_id: kid, state: {} }).select().single();
  expect(error).toBeNull();
  return data.id as string;
};
const count = async (table: string, kid: string) =>
  (await admin().from(table).select("*", { count: "exact", head: true }).eq("kid_id", kid)).count;

beforeAll(async () => {
  A = await makeParent(`h-a-${run}@test.dev`, { consent: true });
  B = await makeParent(`h-b-${run}@test.dev`, { consent: true });
  kidX = await newKid(A, "Two");
});

describe("attempts", () => {
  it("rejects the same attempt twice and keeps one row", async () => {
    const k = await newKid(A, "Dup");
    const s = await newSession(k);
    const row = attempt(k, s, "2026-01-01T00:00:00Z");
    expect((await A.client.from("attempts").insert(row)).error).toBeNull();
    expect((await A.client.from("attempts").insert(row)).error).not.toBeNull();
    const { data } = await A.client.from("attempts").select("id").eq("session_id", s);
    expect(data).toHaveLength(1);
  });
  it("rejects B writing attempts or skill_state for A's kid, writing nothing", async () => {
    const kid = await newKid(A, "Guarded");
    const s = await newSession(kid);
    expect((await B.client.from("attempts").insert(attempt(kid, s, "2026-01-02T00:00:00Z"))).error).not.toBeNull();
    expect((await B.client.from("skill_state").insert(skill(kid))).error).not.toBeNull();
    expect(await count("attempts", kid)).toBe(0);
    expect(await count("skill_state", kid)).toBe(0);
  });
});

describe("save_step", () => {
  it("lets exactly one of two concurrent saves at the same version win", async () => {
    const s = await newSession(await newKid(A, "Race"));
    const rs = await Promise.all([save(A.client, s, 0), save(A.client, s, 0)]);
    expect(rs.every((r) => r.error === null)).toBe(true);
    expect(rs.map((r) => r.data).sort()).toEqual([-1, 1]);
  });
  it("writes to the session's own kid and session even if the payload names a sibling's", async () => {
    const own = await newKid(A, "Own");
    const s = await newSession(own);
    const sibling = await newSession(kidX);
    const r = await save(A.client, s, 0, {
      attempts: [attempt(kidX, sibling, "2026-01-03T00:00:00Z")],
      skills: [skill(kidX)],
      styles: [{ kid_id: kidX, style: "visual", tries: 1, wins: 1 }],
    });
    expect(r.error).toBeNull();
    expect(r.data).toBe(1);
    const ad = admin();
    const att = await ad.from("attempts").select("kid_id, session_id").eq("session_id", s);
    expect(att.data).toEqual([{ kid_id: own, session_id: s }]);
    expect(await count("skill_state", own)).toBe(1);
    expect(await count("style_stats", own)).toBe(1);
    expect(await count("attempts", kidX)).toBe(0);
    expect(await count("skill_state", kidX)).toBe(0);
    expect(await count("style_stats", kidX)).toBe(0);
  });
  it("returns -1 and writes nothing for an ended session", async () => {
    const kid = await newKid(A, "Three");
    const s = await newSession(kid);
    expect((await save(A.client, s, 0, { ended: true })).data).toBe(1);
    const r = await save(A.client, s, 1, { attempts: [attempt(kid, s, "2026-01-04T00:00:00Z")], skills: [skill(kid)] });
    expect(r.error).toBeNull();
    expect(r.data).toBe(-1);
    expect(await count("attempts", kid)).toBe(0);
    expect(await count("skill_state", kid)).toBe(0);
  });
});
