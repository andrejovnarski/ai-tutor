import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
const { collectWeek } = await import("./collect");
const { kidWeek } = await import("../parentSummary");

const KID = "kid-123";
const NOW = new Date(Date.UTC(2026, 9, 18, 21)); // Sunday 17:00 New York
const FROM = new Date(NOW.getTime() - 7 * 86_400_000);
const T = NOW.getTime() - 86_400_000;
const kid = { id: KID, nickname: "Rae", grade: "1", age_band: "5-7", placed: true };
const session = {
  started_at: new Date(T - 600_000).toISOString(), ended_at: new Date(T).toISOString(),
  problems: 4, firstTryCorrect: 2, mastered: [], lastActivity: T,
};

type Result = { data: unknown; error: unknown };

/** A fake client: any chain of builder calls on a table resolves to that table's result. Records each table read. */
function fake(tables: Record<string, Result>) {
  const reads: string[] = [];
  const from = vi.fn((t: string) => {
    reads.push(t);
    const q: Record<string, unknown> = new Proxy({}, {
      get: (_, key) => key === "then"
        ? (ok: (v: Result) => unknown) => ok(tables[t] ?? { data: [], error: null })
        : key === "maybeSingle"
          ? () => Promise.resolve(tables[t] ?? { data: null, error: null })
          : () => q,
    });
    return q;
  });
  return { db: { from } as unknown as SupabaseClient, reads };
}

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("kidWeek (the child page)", () => {
  it("does not load rewards rows, even with REWARDS=on", async () => {
    vi.stubEnv("REWARDS", "on");
    const { db, reads } = fake({ kids: { data: kid, error: null }, sessions: { data: [session], error: null } });
    const r = await kidWeek(db, KID, NOW);
    expect(r).not.toBeNull();
    expect(reads).not.toContain("sessions");
    expect(r!.week).not.toHaveProperty("rewards");
  });
});

describe("collectWeek (the email)", () => {
  const tables = (sessions: Result) => ({ kids: { data: [kid], error: null }, sessions });

  it("adds the rewards line with REWARDS=on", async () => {
    vi.stubEnv("REWARDS", "on");
    const { db } = fake(tables({ data: [session], error: null }));
    const [week] = await collectWeek(db, "parent-1", FROM, NOW);
    expect(week!.rewards).toMatch(/^Rae earned \d+ stickers?\.$/);
  });

  it("REWARDS=off makes no rewards query and adds no line", async () => {
    vi.stubEnv("REWARDS", "off");
    const { db, reads } = fake(tables({ data: [session], error: null }));
    const [week] = await collectWeek(db, "parent-1", FROM, NOW);
    expect(reads).not.toContain("sessions");
    expect(week).not.toHaveProperty("rewards");
  });

  it("a failing rewards load still gives the report, without the line, logging only the kid id", async () => {
    vi.stubEnv("REWARDS", "on");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fake(tables({ data: null, error: { message: "boom Rae" } }));
    const weeks = await collectWeek(db, "parent-1", FROM, NOW);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({ nickname: "Rae", sessions: 0 });
    expect(weeks[0]).not.toHaveProperty("rewards");
    expect(err).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(err.mock.calls[0]);
    expect(logged).toContain(KID);
    expect(logged).not.toContain("Rae");
    expect(logged).not.toContain("boom");
  });
});

it("placement-only reward rows leave the weekly report unchanged", async () => {
  vi.stubEnv("REWARDS", "on");
  const tables = { kids: { data: [kid], error: null }, sessions: { data: [session], error: null } };
  const baseline = await collectWeek(fake(tables).db, "parent-1", FROM, NOW);
  const placed = await collectWeek(fake({ ...tables, skill_state: { data: [{
    skill_id: "count-to-20.objects-to-10", placed: true, mastered_at: null,
    p_known: 0.99, attempts: 0, level: 1, correct_streak: 0, wrong_streak: 0, recent_tags: [],
  }], error: null } }).db, "parent-1", FROM, NOW);
  expect(placed[0]!.rewards).toEqual(baseline[0]!.rewards);
  expect(placed[0]!.mastered).toEqual(baseline[0]!.mastered);
});
