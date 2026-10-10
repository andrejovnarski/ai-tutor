import { describe, it, expect, beforeAll, vi } from "vitest";
import { admin, makeParent } from "../helpers/admin";

vi.mock("server-only", () => ({}));
const { lastPlayed, kidWeek } = await import("../../src/server/parentSummary");
const { collectKid, collectWeek } = await import("../../src/server/report/collect");

const run = Date.now();
const NOW = new Date("2026-10-11T21:00:00Z"); // Sunday 17:00 EDT
const at = (iso: string) => new Date(iso).toISOString();

let a: Awaited<ReturnType<typeof makeParent>>, b: Awaited<ReturnType<typeof makeParent>>;
let kidA: string, kidNone: string, kidB: string;

async function seedKid(parentId: string, nickname: string) {
  const { data, error } = await admin().from("kids")
    .insert({ parent_id: parentId, nickname, grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(error).toBeNull();
  return data.id as string;
}
async function seedAttempt(kid: string, iso: string) {
  const { data: s, error: se } = await admin().from("sessions")
    .insert({ kid_id: kid, state: {}, started_at: at(iso), ended_at: at(iso) }).select().single();
  expect(se).toBeNull();
  const { error } = await admin().from("attempts").insert({
    kid_id: kid, session_id: s.id, skill_id: "add-within-10.count-on", template_id: "t", seed: 1, level: 1, answer: 3,
    result: "correct", mistake_tag: null, style: null, time_ms: 60_000, at: at(iso), try: 1, mode: "practice",
  });
  expect(error).toBeNull();
}

beforeAll(async () => {
  a = await makeParent(`ps-a-${run}@test.dev`, { consent: true });
  b = await makeParent(`ps-b-${run}@test.dev`, { consent: true });
  kidA = await seedKid(a.userId, "Ann");
  kidNone = await seedKid(a.userId, "Newt");
  kidB = await seedKid(b.userId, "Bo");
  await seedAttempt(kidA, "2026-10-05T15:00:00Z"); // Mon
  await seedAttempt(kidA, "2026-10-08T15:00:00Z"); // Thu
  await seedAttempt(kidA, "2026-10-03T15:00:00Z"); // 8 days before NOW: out of range
  await seedAttempt(kidB, "2026-10-09T15:00:00Z");
});

describe("lastPlayed", () => {
  it("maps each kid to the newest attempt, and omits kids with none", async () => {
    const m = await lastPlayed(a.client, [kidA, kidNone]);
    expect(m.get(kidA)?.toISOString()).toBe("2026-10-08T15:00:00.000Z");
    expect(m.has(kidNone)).toBe(false);
  });
});

describe("kidWeek", () => {
  it("counts played days and sessions in the last 7 days only", async () => {
    const r = await kidWeek(a.client, kidA, NOW);
    expect(r).not.toBeNull();
    expect(r!.playedDays).toEqual(["2026-10-05", "2026-10-08"]);
    expect(r!.week.nickname).toBe("Ann");
    expect(r!.week.sessions).toBe(2);
  });

  it("spans exactly 7 New York dates: the edge day before the window is excluded", async () => {
    const edge = await seedKid(a.userId, "Edge");
    await seedAttempt(edge, "2026-10-05T03:00:00Z"); // Oct 4, 23:00 EDT: 8 NY dates back
    await seedAttempt(edge, "2026-10-05T04:30:00Z"); // Oct 5, 00:30 EDT: first minute of the window
    await seedAttempt(edge, "2026-10-11T13:00:00Z"); // today, morning
    const r = await kidWeek(a.client, edge, NOW);
    expect(r!.playedDays).toEqual(["2026-10-05", "2026-10-11"]);
    expect(r!.playedDays.length).toBeLessThanOrEqual(7);
    expect(r!.week.sessions).toBe(2);
  });

  it("returns null for another family's kid", async () => {
    expect(await kidWeek(a.client, kidB, NOW)).toBeNull();
  });

  it("collectWeek still returns collectKid's week", async () => {
    const from = new Date(NOW.getTime() - 7 * 86_400_000);
    const weeks = await collectWeek(admin(), a.userId, from, NOW);
    const { data: kid } = await admin().from("kids").select("id, nickname, grade, age_band, placed").eq("id", kidA).single();
    const one = await collectKid(admin(), kid as never, from, NOW);
    expect(weeks.find((w) => w.nickname === "Ann")).toEqual(one.week);
  });
});
