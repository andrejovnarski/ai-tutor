import { describe, it, expect, beforeAll, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, makeParent } from "../helpers/admin";
import { MASTERED_P, MASTERED_ATTEMPTS } from "../../src/domain/kid/bkt";

vi.mock("server-only", () => ({}));
import { mailpitMailer } from "../../src/server/email/mailer";

const run = Date.now();
let A: { userId: string; client: SupabaseClient };
let B: { userId: string; client: SupabaseClient };
let kidA: string;

const denied = (r: { error: { code?: string } | null; data?: unknown }) =>
  r.error ? r.error.code === "42501" : (r.data as unknown[] | null ?? []).length === 0;

beforeAll(async () => {
  A = await makeParent(`p3b-a-${run}@test.dev`, { consent: true });
  B = await makeParent(`p3b-b-${run}@test.dev`, { consent: true });
  const { data, error } = await A.client.from("kids")
    .insert({ parent_id: A.userId, nickname: "Ann", grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(error).toBeNull();
  kidA = data.id;
});

describe("new tables are not writable by parents", () => {
  it("insert into consents, distress_flags, report_sends is denied", async () => {
    expect(denied(await A.client.from("consents")
      .insert({ parent_id: A.userId, notice_version: "v1", method: "fake", ref: `x-${run}` }).select())).toBe(true);
    expect(denied(await A.client.from("distress_flags").insert({ kid_id: kidA, line: "hi" }).select())).toBe(true);
    expect(denied(await A.client.from("report_sends")
      .insert({ parent_id: A.userId, week_start: "2026-01-05" }).select())).toBe(true);
  });

  it("parent B cannot see A's distress flags; A can", async () => {
    const { error } = await admin().from("distress_flags").insert({ kid_id: kidA, line: "I am sad" });
    expect(error).toBeNull();
    expect((await B.client.from("distress_flags").select()).data).toEqual([]);
    expect((await A.client.from("distress_flags").select()).data).toHaveLength(1);
  });
});

describe("grant_consent", () => {
  it("is service_role only, sets consent_at, and is idempotent per ref", async () => {
    const P = await makeParent(`p3b-c-${run}@test.dev`);
    const args = { p_parent: P.userId, p_notice: "v1", p_method: "fake", p_ref: `ref-${run}` };
    expect((await P.client.rpc("grant_consent", args)).error?.code).toBe("42501");
    expect((await admin().from("parents").select("consent_at").eq("id", P.userId).single()).data?.consent_at).toBeNull();

    expect((await admin().rpc("grant_consent", args)).error).toBeNull();
    expect((await admin().from("parents").select("consent_at").eq("id", P.userId).single()).data?.consent_at).not.toBeNull();
    expect((await admin().rpc("grant_consent", args)).error).toBeNull();
    const rows = await admin().from("consents").select().eq("ref", args.p_ref);
    expect(rows.data).toHaveLength(1);
  });
});

describe("skill_state.mastered_at", () => {
  const row = (skill: string, p_known: number, attempts: number, placed = false) => ({
    kid_id: kidA, skill_id: skill, p_known, attempts, level: 1, correct_streak: 0, wrong_streak: 0,
    placed, recent_tags: [],
  });
  const get = async (skill: string) =>
    (await admin().from("skill_state").select("mastered_at").eq("kid_id", kidA).eq("skill_id", skill).single()).data!.mastered_at;

  it("is set when an update crosses the line, and kept afterwards", async () => {
    const a = admin();
    expect((await a.from("skill_state").insert(row("m1", 0.9, 5))).error).toBeNull();
    expect(await get("m1")).toBeNull();
    await a.from("skill_state").update({ p_known: 0.96 }).eq("kid_id", kidA).eq("skill_id", "m1");
    const first = await get("m1");
    expect(first).not.toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    await a.from("skill_state").update({ p_known: 0.5, attempts: 6 }).eq("kid_id", kidA).eq("skill_id", "m1");
    expect(await get("m1")).toBe(first);
  });

  it("placement alone does not set it", async () => {
    expect((await admin().from("skill_state").insert(row("m2", 0.99, 0, true))).error).toBeNull();
    expect(await get("m2")).toBeNull();
  });

  it("thresholds equal MASTERED_P and MASTERED_ATTEMPTS", async () => {
    const cases: [string, number, number, boolean][] = [
      ["b1", MASTERED_P - 0.0001, MASTERED_ATTEMPTS, false],
      ["b2", MASTERED_P, MASTERED_ATTEMPTS, true],
      ["b3", MASTERED_P, MASTERED_ATTEMPTS - 1, false],
      ["b4", MASTERED_P, MASTERED_ATTEMPTS, true],
    ];
    for (const [s, p, n, want] of cases) {
      expect((await admin().from("skill_state").insert(row(s, p, n))).error).toBeNull();
      expect(await get(s) !== null, s).toBe(want);
    }
  });
});

describe("mailpitMailer against local Mailpit", () => {
  it("delivers a message", async () => {
    const to = `p3b-mail-${run}@test.dev`;
    await mailpitMailer.send({ to, subject: "Hello", text: "plain", html: "<p>html</p>" });
    const list = (await (await fetch("http://127.0.0.1:54324/api/v1/messages")).json()) as
      { messages: { Subject: string; To: { Address: string }[] }[] };
    expect(list.messages.some((m) => m.Subject === "Hello" && m.To.some((t) => t.Address === to))).toBe(true);
  });
});
