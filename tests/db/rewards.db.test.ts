import { beforeAll, describe, expect, it, vi } from "vitest";
import { admin, makeParent } from "../helpers/admin";

vi.mock("server-only", () => ({}));
const { loadRewardRows } = await import("../../src/server/rewards");

const run = Date.now();
let a: Awaited<ReturnType<typeof makeParent>>, b: Awaited<ReturnType<typeof makeParent>>;
let kid: string;
const T1 = Date.UTC(2026, 8, 1, 15), T2 = Date.UTC(2026, 8, 3, 15);

beforeAll(async () => {
  a = await makeParent(`rw-a-${run}@test.dev`, { consent: true });
  b = await makeParent(`rw-b-${run}@test.dev`, { consent: true });
  const k = await admin().from("kids").insert({ parent_id: a.userId, nickname: "Ann", grade: "K", age_band: "5-7", avatar: "fox" }).select().single();
  expect(k.error).toBeNull();
  kid = k.data.id;
  const st = (problems: number, last: number) => ({ problems, firstTryCorrect: 1, mastered: [], lastActivity: last });
  const rows = [
    { kid_id: kid, state: st(3, T1), started_at: new Date(T1 - 600_000).toISOString(), ended_at: new Date(T1).toISOString() },
    { kid_id: kid, state: st(5, T2), started_at: new Date(T2 - 600_000).toISOString(), ended_at: new Date(T2 + 1000).toISOString() },
    { kid_id: kid, state: st(1, T2 + 5000), started_at: new Date(T2 + 5000).toISOString(), ended_at: null },
  ];
  const { error } = await admin().from("sessions").insert(rows);
  expect(error).toBeNull();
});

describe("loadRewardRows", () => {
  it("returns only ended sessions with exactly the needed fields, and the latest by ended_at has the latest lastActivity", async () => {
    const { sessions } = await loadRewardRows(a.client, kid);
    expect(sessions).toHaveLength(2);
    for (const s of sessions) {
      expect(Object.keys(s).sort()).toEqual(["endedAt", "firstTryCorrect", "lastActivity", "mastered", "problems", "startedAt"]);
    }
    const byEnd = [...sessions].sort((x, y) => x.endedAt! - y.endedAt!);
    const byAct = [...sessions].sort((x, y) => x.lastActivity - y.lastActivity);
    expect(byEnd.at(-1)).toEqual(byAct.at(-1));
    expect(byEnd.at(-1)).toMatchObject({ problems: 5, lastActivity: T2 });
  });

  it("returns learned skills in masteredAt and placement-known skills in placed, nothing else", async () => {
    const base = { kid_id: kid, attempts: 0, level: 1, correct_streak: 0, wrong_streak: 0, recent_tags: [] };
    const { error } = await admin().from("skill_state").insert([
      { ...base, skill_id: "count-to-20.objects-to-10", p_known: 0.99, attempts: 6, placed: false },
      { ...base, skill_id: "count-to-20.objects-to-20", p_known: 0.97, placed: true },
      { ...base, skill_id: "count-to-20.number-after", p_known: 0.3, placed: false },
    ]);
    expect(error).toBeNull();
    const { masteredAt, placed } = await loadRewardRows(a.client, kid);
    expect(Object.keys(masteredAt)).toEqual(["count-to-20.objects-to-10"]);
    expect(Number.isFinite(masteredAt["count-to-20.objects-to-10"])).toBe(true);
    expect(placed).toEqual(["count-to-20.objects-to-20"]);
    expect((await loadRewardRows(b.client, kid)).placed).toEqual([]);
  });

  it("another family sees nothing (RLS)", async () => {
    expect((await loadRewardRows(b.client, kid)).sessions).toHaveLength(0);
  });
});
