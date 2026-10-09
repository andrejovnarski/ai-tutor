import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, anon, latestEmailLink, makeParent } from "../helpers/admin";

const run = Date.now();
const kidRow = (parent_id: string) => ({ parent_id, nickname: "Kit", grade: "2", age_band: "5-7", avatar: "fox" });
const tables = ["parents", "kids", "skill_state", "style_stats", "attempts", "sessions"];

let A: { userId: string; client: SupabaseClient };
let B: { userId: string; client: SupabaseClient };
let C: { userId: string; client: SupabaseClient };
let kidId: string;
let sessionId: string;

beforeAll(async () => {
  A = await makeParent(`a-${run}@test.dev`, { consent: true });
  B = await makeParent(`b-${run}@test.dev`, { consent: true });
  C = await makeParent(`c-${run}@test.dev`);
  const { data, error } = await A.client.from("kids").insert(kidRow(A.userId)).select().single();
  expect(error).toBeNull();
  kidId = data.id;
  const ad = admin();
  const s = await ad.from("sessions").insert({ kid_id: kidId, state: {} }).select().single();
  sessionId = s.data.id;
  await ad.from("skill_state").insert({ kid_id: kidId, skill_id: "add", p_known: 0.5, attempts: 1, level: 1, correct_streak: 0, wrong_streak: 0, placed: false, recent_tags: [] });
  await ad.from("style_stats").insert({ kid_id: kidId, style: "visual", tries: 1, wins: 1 });
  await ad.from("attempts").insert({ kid_id: kidId, session_id: sessionId, skill_id: "add", template_id: "t", seed: 1, level: 1, answer: 2, result: "correct", time_ms: 10, at: new Date().toISOString(), try: 1, mode: "practice" });
});

describe("parents", () => {
  it("a new auth user gets a parents row", async () => {
    const { data } = await admin().from("parents").select("id").eq("id", A.userId);
    expect(data).toHaveLength(1);
  });
  it("rejects updating own consent_at or pin_hash", async () => {
    const r1 = await A.client.from("parents").update({ consent_at: null }).eq("id", A.userId);
    expect(r1.error).not.toBeNull();
    const r2 = await A.client.from("parents").update({ pin_hash: "x" }).eq("id", A.userId);
    expect(r2.error).not.toBeNull();
  });
  it("lets a parent read only their own row", async () => {
    const { data } = await A.client.from("parents").select("id");
    expect(data?.map((r) => r.id)).toEqual([A.userId]);
  });
});

describe("kids", () => {
  it("consented parent can insert", () => expect(kidId).toBeTruthy());
  it("parent without consent is rejected", async () => {
    const { error } = await C.client.from("kids").insert(kidRow(C.userId));
    expect(error).not.toBeNull();
  });
  it("cannot insert a kid for another parent", async () => {
    const { error } = await B.client.from("kids").insert(kidRow(A.userId));
    expect(error).not.toBeNull();
  });
  it("B cannot update or delete A's kid", async () => {
    const u = await B.client.from("kids").update({ nickname: "x" }).eq("id", kidId).select();
    expect(u.data).toHaveLength(0);
    const d = await B.client.from("kids").delete().eq("id", kidId).select();
    expect(d.data).toHaveLength(0);
  });
});

describe("cross-parent reads", () => {
  for (const t of ["kids", "skill_state", "style_stats", "attempts", "sessions"]) {
    it(`B sees 0 ${t} rows of A`, async () => {
      const { data, error } = await B.client.from(t).select("*");
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
    it(`A sees own ${t} rows`, async () => {
      const { data } = await A.client.from(t).select("*");
      expect(data!.length).toBeGreaterThan(0);
    });
  }
  it("A cannot update or delete own attempts", async () => {
    const u = await A.client.from("attempts").update({ answer: 9 }).eq("kid_id", kidId).select();
    expect(u.data ?? []).toHaveLength(0);
    const d = await A.client.from("attempts").delete().eq("kid_id", kidId).select();
    expect(d.data ?? []).toHaveLength(0);
    const { data } = await admin().from("attempts").select("id").eq("kid_id", kidId);
    expect(data).toHaveLength(1);
  });
});

describe("anon", () => {
  for (const t of tables) {
    it(`reads nothing from ${t}`, async () => {
      const { data, error } = await anon().from(t).select("*");
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    });
  }
});

describe("save_step", () => {
  const args = (v: number, over = {}) => ({
    p_session: sessionId, p_version: v, p_state: { n: v }, p_ended: false,
    p_attempts: [], p_skill_states: [], p_style_stats: [], p_kid_placed: false, ...over,
  });
  it("returns -1 and writes nothing on version mismatch", async () => {
    const att = [{ kid_id: kidId, session_id: sessionId, skill_id: "x", template_id: "t", seed: 1, level: 1, answer: 1, result: "correct", time_ms: 1, at: new Date().toISOString(), try: 1, mode: "practice" }];
    const { data } = await A.client.rpc("save_step", args(99, { p_attempts: att, p_kid_placed: true }));
    expect(data).toBe(-1);
    const k = await admin().from("kids").select("placed").eq("id", kidId).single();
    expect(k.data!.placed).toBe(false);
    const a = await admin().from("attempts").select("id").eq("skill_id", "x");
    expect(a.data).toHaveLength(0);
  });
  it("applies a step, bumps version, and ends the session", async () => {
    const at = new Date().toISOString();
    const att = [{ kid_id: kidId, session_id: sessionId, skill_id: "y", template_id: "t", seed: 1, level: 1, answer: 1, result: "correct", time_ms: 1, at, try: 1, mode: "practice" }];
    const ss = [{ kid_id: kidId, skill_id: "add", p_known: 0.9, attempts: 2, level: 2, correct_streak: 1, wrong_streak: 0, placed: true, recent_tags: [] }];
    const st = [{ kid_id: kidId, style: "visual", tries: 2, wins: 2 }];
    const { data, error } = await A.client.rpc("save_step", args(0, { p_attempts: att, p_skill_states: ss, p_style_stats: st, p_kid_placed: true, p_ended: true }));
    expect(error).toBeNull();
    expect(data).toBe(1);
    const ad = admin();
    expect((await ad.from("sessions").select("*").eq("id", sessionId).single()).data).toMatchObject({ version: 1, state: { n: 0 } });
    expect((await ad.from("sessions").select("ended_at").eq("id", sessionId).single()).data!.ended_at).not.toBeNull();
    expect((await ad.from("skill_state").select("p_known").eq("kid_id", kidId).eq("skill_id", "add").single()).data!.p_known).toBe(0.9);
    expect((await ad.from("style_stats").select("tries").eq("kid_id", kidId).single()).data!.tries).toBe(2);
    expect((await ad.from("kids").select("placed").eq("id", kidId).single()).data!.placed).toBe(true);
    expect((await ad.from("attempts").select("id").eq("skill_id", "y")).data).toHaveLength(1);
  });
  it("B cannot step A's session", async () => {
    const { data } = await B.client.rpc("save_step", args(1));
    expect(data).toBe(-1);
  });
});

describe("cascade", () => {
  it("deleting A's kid removes dependent rows", async () => {
    const { error } = await A.client.from("kids").delete().eq("id", kidId);
    expect(error).toBeNull();
    const ad = admin();
    for (const t of ["skill_state", "style_stats", "attempts", "sessions"]) {
      const { data } = await ad.from(t).select("*").eq("kid_id", kidId);
      expect(data, t).toHaveLength(0);
    }
  });
});

describe("magic-link email", () => {
  it("links to /auth/confirm on the site URL", async () => {
    const email = `mail-${run}@test.dev`;
    const { error } = await anon().auth.signInWithOtp({ email });
    expect(error).toBeNull();
    const link = await latestEmailLink(email);
    expect(link).toMatch(/^http:\/\/localhost:3000\/auth\/confirm\?token_hash=.+&type=email$/);
  });
});
