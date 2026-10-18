import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin, makeParent } from "../helpers/admin";
import { SupabaseRepo } from "../../src/server/persist/supabaseRepo";
import { playAgain, playAnswer, playTurn, type AnswerResult } from "../../src/server/play";
import { startSession } from "../../src/domain/session/engine";
import { firstSkills, placedKid } from "../../src/domain/session/testkit";
import { skillRow } from "../../src/server/persist/rows";

const run = Date.now();
const seed = () => 42;
const ok = <T extends { status: number }>(r: T) => r as Extract<T, { status: 200 }>;

let A: { userId: string; client: SupabaseClient };
let B: { userId: string; client: SupabaseClient };
let n = 0;

/** A fresh kid of A's, already placed on three skills (or unplaced), so tests do not share sessions. */
async function kidFor(placed: boolean): Promise<string> {
  const { data, error } = await A.client.from("kids")
    .insert({ parent_id: A.userId, nickname: `K${++n}`, grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(error).toBeNull();
  if (placed) {
    const skills = Object.values(placedKid(firstSkills(3)).skills).filter((s) => s.placed).map((s) => skillRow(data.id, s));
    const ad = admin();
    expect((await ad.from("skill_state").insert(skills)).error).toBeNull();
    expect((await ad.from("kids").update({ placed: true }).eq("id", data.id)).error).toBeNull();
  }
  return data.id;
}
const repoA = () => new SupabaseRepo(A.client);
const attemptCount = async (kid: string) =>
  (await admin().from("attempts").select("*", { count: "exact", head: true }).eq("kid_id", kid)).count;
const openSessions = async (kid: string) =>
  (await admin().from("sessions").select("id").eq("kid_id", kid).is("ended_at", null)).data!;
const pending = async (kid: string) =>
  (await admin().from("sessions").select("state").eq("kid_id", kid).is("ended_at", null).single()).data!.state.pending.problem.answer as number;

beforeAll(async () => {
  A = await makeParent(`r-a-${run}@test.dev`, { consent: true });
  B = await makeParent(`r-b-${run}@test.dev`, { consent: true });
});

describe("Play against Supabase", () => {
  it("plays a first turn at version 1 and takes an answer to version 2", async () => {
    const kid = await kidFor(true);
    const t = ok(await playTurn(repoA(), kid, 1000, seed));
    expect(t.version).toBe(1);
    expect(t.turn.kind).toBe("problem");
    const a = ok(await playAnswer(repoA(), kid, 1, await pending(kid), 5000, seed));
    expect(a.version).toBe(2);
    expect(a.feedback.result.kind).toBe("correct");
    expect("revealed" in a).toBe(false);
    expect(await attemptCount(kid)).toBe(1);
  });
  it("answers 409 on a replayed version and stores exactly one attempt", async () => {
    const kid = await kidFor(true);
    await playTurn(repoA(), kid, 1000, seed);
    const right = await pending(kid);
    await playAnswer(repoA(), kid, 1, right, 5000, seed);
    const again = await playAnswer(repoA(), kid, 1, right, 6000, seed);
    expect(again.status).toBe(409);
    if (again.status === 409) expect(again.version).toBe(2);
    expect(await attemptCount(kid)).toBe(1);
  });
  it("lets exactly one of two racing answers win", async () => {
    const kid = await kidFor(true);
    await playTurn(repoA(), kid, 1000, seed);
    const right = await pending(kid);
    const rs: AnswerResult[] = await Promise.all([
      playAnswer(repoA(), kid, 1, right, 5000, seed),
      playAnswer(repoA(), kid, 1, right, 5000, seed),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await attemptCount(kid)).toBe(1);
  });
  it("resumes the same problem without bumping the version", async () => {
    const kid = await kidFor(true);
    const a = ok(await playTurn(repoA(), kid, 1000, seed));
    const b = ok(await playTurn(repoA(), kid, 2000, seed));
    expect(b.version).toBe(a.version);
    expect(b.turn).toEqual(a.turn);
  });
  it("reveals the answer after a second wrong try, and not after the first", async () => {
    const kid = await kidFor(true);
    await playTurn(repoA(), kid, 1000, seed);
    const answer = await pending(kid);
    const first = ok(await playAnswer(repoA(), kid, 1, answer + 1000, 2000, seed));
    expect(first.feedback.then).toBe("retry");
    expect("revealed" in first).toBe(false);
    const second = ok(await playAnswer(repoA(), kid, first.version, answer + 1000, 3000, seed));
    expect(second.revealed).toBe(answer);
  });
  it("an answer that ends the session returns the end card; Play again starts one new session", async () => {
    const kid = await kidFor(true);
    await playTurn(repoA(), kid, 1000, seed);
    const a = ok(await playAnswer(repoA(), kid, 1, await pending(kid), 1000 + 12 * 60_000, seed));
    expect(a.next.kind).toBe("end");
    expect(await openSessions(kid)).toHaveLength(0);
    const again = ok(await playAgain(repoA(), kid, 1000 + 12 * 60_000 + 1, seed));
    expect(again.turn.kind).toBe("problem");
    expect(await openSessions(kid)).toHaveLength(1);
    const all = (await admin().from("sessions").select("id").eq("kid_id", kid)).data!;
    expect(all).toHaveLength(2);
  });
  it("a stale answer after the session ended gets the end card and creates nothing; Play again then starts the second session", async () => {
    const kid = await kidFor(true);
    const a = ok(await playTurn(repoA(), kid, 1000, seed));
    const b = ok(await playTurn(repoA(), kid, 1000, seed));
    expect(b.version).toBe(a.version);
    const right = await pending(kid);
    const won = ok(await playAnswer(repoA(), kid, b.version, right, 1000 + 12 * 60_000, seed));
    expect(won.next.kind).toBe("end");
    const attemptsBefore = await attemptCount(kid);
    const stale = await playAnswer(repoA(), kid, a.version, right, 1000 + 12 * 60_000 + 1, seed);
    expect(stale.status).toBe(409);
    if (stale.status === 409) {
      expect(stale.turn.kind).toBe("end");
      expect(stale.version).toBe(won.version);
    }
    expect((await admin().from("sessions").select("id").eq("kid_id", kid)).data).toHaveLength(1);
    expect(await attemptCount(kid)).toBe(attemptsBefore);
    ok(await playAgain(repoA(), kid, 1000 + 12 * 60_000 + 2, seed));
    expect((await admin().from("sessions").select("id").eq("kid_id", kid)).data).toHaveLength(2);
    expect(await openSessions(kid)).toHaveLength(1);
  });
  it("lets two racing first turns share one new session", async () => {
    const kid = await kidFor(true);
    const [a, b] = await Promise.all([playTurn(repoA(), kid, 1000, seed), playTurn(repoA(), kid, 1000, seed)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(ok(a).turn).toEqual(ok(b).turn);
    expect(await openSessions(kid)).toHaveLength(1);
  });
});

describe("SupabaseRepo contract", () => {
  it("createSession returns null when the kid already has an open session", async () => {
    const kid = await kidFor(true);
    const state = startSession(placedKid(firstSkills(3)), 1, 0);
    expect(await repoA().createSession(kid, state)).not.toBeNull();
    expect(await repoA().createSession(kid, state)).toBeNull();
    expect(await openSessions(kid)).toHaveLength(1);
  });
  it("createSession starts at the kid's previous final version, even if the client sends one", async () => {
    const kid = await kidFor(true);
    const state = startSession(placedKid(firstSkills(3)), 1, 0);
    const s = (await repoA().createSession(kid, state))!;
    expect(s.version).toBe(0);
    expect(await repoA().saveStep(s, s.state, false, null)).toBe(1);
    expect(await repoA().saveStep({ ...s, version: 1 }, s.state, true, null)).toBe(2);
    expect((await repoA().createSession(kid, state))!.version).toBe(2);
    const forged = await A.client.from("sessions").update({ ended_at: new Date().toISOString() }).eq("kid_id", kid).is("ended_at", null);
    expect(forged.error).toBeNull();
    const { data, error } = await A.client.from("sessions").insert({ kid_id: kid, state, version: 0 }).select("version").single();
    expect(error).toBeNull();
    expect(data!.version).toBe(2);
  });
  it("saveStep with a stale version returns -1 and adds no attempts", async () => {
    const kid = await kidFor(true);
    const s = (await repoA().createSession(kid, startSession(placedKid(firstSkills(3)), 1, 0)))!;
    expect(await repoA().saveStep(s, s.state, false, null)).toBe(1);
    const attempt = { kidId: kid, skillId: "x", templateId: "t", seed: 1, level: 1 as const, answer: 1, result: "correct" as const,
      mistakeTag: null, style: null, timeMs: 1, at: 1, try: 1 as const, mode: "practice" as const };
    const writes = { kidId: kid, attempts: [attempt], skillStates: [], styleStats: [] };
    expect(await repoA().saveStep(s, s.state, false, writes)).toBe(-1);
    expect(await attemptCount(kid)).toBe(0);
  });
  it("loadKid returns null for another family's kid, and playTurn is 404 with nothing written", async () => {
    const kid = await kidFor(true);
    const repoB = new SupabaseRepo(B.client);
    expect(await repoB.loadKid(kid)).toBeNull();
    expect(await playTurn(repoB, kid, 1000, seed)).toEqual({ status: 404 });
    expect((await admin().from("sessions").select("id").eq("kid_id", kid)).data).toHaveLength(0);
  });
  it("lastEnded returns the most recently ended session, and null for another family's kid", async () => {
    const kid = await kidFor(true);
    const state = startSession(placedKid(firstSkills(3)), 1, 0);
    expect(await repoA().lastEnded(kid)).toBeNull();
    const a = (await repoA().createSession(kid, state))!;
    expect(await repoA().lastEnded(kid)).toBeNull();
    await repoA().saveStep(a, a.state, true, null);
    const b = (await repoA().createSession(kid, state))!;
    await repoA().saveStep(b, b.state, true, null);
    const last = (await repoA().lastEnded(kid))!;
    expect(last.id).toBe(b.id);
    expect(last.version).toBe(b.version + 1);
    expect(await new SupabaseRepo(B.client).lastEnded(kid)).toBeNull();
  });
  it("loadKid returns null for an id that is not a uuid", async () => {
    expect(await repoA().loadKid("nope")).toBeNull();
  });
  it("finishing placement sets kids.placed and stores a skill_state row per placed skill", async () => {
    const kid = await kidFor(false);
    expect((await repoA().loadKid(kid))!.placed).toBe(false);
    await playTurn(repoA(), kid, 1000, seed);
    let now = 1000;
    for (let i = 0; i < 60; i++) {
      const loaded = (await repoA().loadKid(kid))!;
      if (loaded.placed) break;
      const open = (await repoA().openSession(kid))!;
      now += 5000;
      const r = ok(await playAnswer(repoA(), kid, open.version, open.state.pending!.problem.answer, now, seed));
      expect(r.status).toBe(200);
    }
    const done = (await repoA().loadKid(kid))!;
    expect(done.placed).toBe(true);
    const placedIds = Object.values(done.skills).filter((s) => s.placed).map((s) => s.skillId).sort();
    expect(placedIds.length).toBeGreaterThan(0);
    const rows = (await admin().from("skill_state").select("skill_id").eq("kid_id", kid).eq("placed", true)).data!;
    expect(rows.map((r) => r.skill_id).sort()).toEqual(placedIds);
    expect((await admin().from("kids").select("placed").eq("id", kid).single()).data!.placed).toBe(true);
  });
});
