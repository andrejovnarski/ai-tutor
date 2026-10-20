import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { endRewards } from "../domain/rewards/progress";

vi.mock("server-only", () => ({}));
const { env } = await import("./env");
const { kidEndRewards, kidProgress, loadRewardRows } = await import("./rewards");
const { withRewards } = await import("./playApi");

const KID = "kid-123";
const T = Date.UTC(2026, 9, 14, 15);
const sessionRow = {
  started_at: new Date(T - 600_000).toISOString(), ended_at: new Date(T).toISOString(),
  problems: 4, firstTryCorrect: 3, mastered: [], lastActivity: T,
};

/** A fake client: every table query resolves to the canned result. */
function fake(tables: Record<string, { data: unknown; error: unknown }>) {
  const from = vi.fn((t: string) => {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    q.select = chain; q.eq = chain; q.not = chain; q.abortSignal = chain;
    q.then = (ok: (v: unknown) => unknown) => ok(tables[t]);
    return q;
  });
  return { db: { from } as unknown as SupabaseClient, from };
}
/** A fake client whose queries never answer, except that, like supabase-js, an aborted one resolves with an error. */
function hanging() {
  const signals: AbortSignal[] = [];
  const from = vi.fn(() => {
    let signal: AbortSignal | undefined;
    const q: Record<string, unknown> = {};
    const chain = () => q;
    q.select = chain; q.eq = chain; q.not = chain;
    q.abortSignal = (s: AbortSignal) => { signal = s; signals.push(s); return q; };
    q.then = (ok: (v: unknown) => unknown) =>
      signal?.addEventListener("abort", () => ok({ data: null, error: { message: "AbortError: aborted" } }));
    return q;
  });
  return { db: { from } as unknown as SupabaseClient, signals };
}
const ok = { sessions: { data: [sessionRow], error: null }, skill_state: { data: [], error: null } };

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("kidEndRewards", () => {
  it("REWARDS off: no rewards and no query", async () => {
    vi.stubEnv("REWARDS", "off");
    const { db, from } = fake(ok);
    expect(await kidEndRewards(db, KID, T)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("REWARDS on: end rewards from rows", async () => {
    vi.stubEnv("REWARDS", "on");
    const { db } = fake(ok);
    const facts = [{ startedAt: T - 600_000, endedAt: T, lastActivity: T, problems: 4, firstTryCorrect: 3, mastered: [] }];
    const r = await kidEndRewards(db, KID, T);
    expect(r).toEqual(endRewards(facts, {}, T));
    expect(r!.xp).toBe(20 + 40 + 15);
  });

  it("a query error gives null and logs only the kid id", async () => {
    vi.stubEnv("REWARDS", "on");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db } = fake({ ...ok, sessions: { data: null, error: { message: "boom nickname" } } });
    expect(await kidEndRewards(db, KID, T)).toBeNull();
    expect(err).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(err.mock.calls[0]);
    expect(logged).toContain(KID);
    expect(logged).not.toContain("nickname");
  });
});

describe("slow reads", () => {
  it("a query that never answers times out: kidProgress and kidEndRewards give null", async () => {
    vi.stubEnv("REWARDS", "on");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, signals } = hanging();
    const started = Date.now();
    expect(await kidProgress(db, KID, T, 30)).toBeNull();
    expect(await kidEndRewards(db, KID, T, 30)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(signals).toHaveLength(4); // both queries, both calls
    expect(err).toHaveBeenCalledTimes(2);
  });

  it("the default timeout is 1.5 seconds", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const { db } = fake(ok);
    await loadRewardRows(db, KID);
    expect(timeout).toHaveBeenCalledTimes(2);
    expect(timeout).toHaveBeenCalledWith(1500);
  });
});

describe("loadRewardRows", () => {
  it("lastActivity falls back to endedAt, then startedAt", async () => {
    const started = new Date(T - 600_000).toISOString();
    const { db } = fake({ ...ok, sessions: { data: [
      { ...sessionRow, lastActivity: null },
      { ...sessionRow, ended_at: null, lastActivity: undefined },
      { ...sessionRow, lastActivity: "soon" },
    ], error: null } });
    const r = await loadRewardRows(db, KID);
    expect(r.sessions.map((s) => s.lastActivity)).toEqual([T, Date.parse(started), T]);
  });

  it("maps names and converts timestamps to ms", async () => {
    const { db } = fake({ ...ok, skill_state: { data: [{ skill_id: "a", mastered_at: new Date(T).toISOString() }], error: null } });
    const r = await loadRewardRows(db, KID);
    expect(r.sessions[0]).toEqual({ startedAt: T - 600_000, endedAt: T, lastActivity: T, problems: 4, firstTryCorrect: 3, mastered: [] });
    expect(r.masteredAt).toEqual({ a: T });
  });
});

describe("env.rewards", () => {
  it("unset and bad values are off", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("REWARDS", "");
    expect(env.rewards()).toBe("off");
    vi.stubEnv("REWARDS", "yes");
    expect(env.rewards()).toBe("off");
    expect(env.rewards()).toBe("off");
    expect(warn).toHaveBeenCalledTimes(1);
    vi.stubEnv("REWARDS", "on");
    expect(env.rewards()).toBe("on");
  });
});

describe("withRewards", () => {
  const problem = { kind: "problem", mode: "practice", try: 1, prompt: {}, input: {} } as never;
  const end = { kind: "end", summary: { problems: 4, firstTryCorrect: 3, minutes: 10, mastered: [] } } as never;

  it("leaves problem turns alone", async () => {
    vi.stubEnv("REWARDS", "on");
    const { db, from } = fake(ok);
    expect(await withRewards(problem, db, KID)).toBe(problem);
    expect(from).not.toHaveBeenCalled();
  });

  it("adds rewards to an end turn", async () => {
    vi.stubEnv("REWARDS", "on");
    vi.useFakeTimers({ now: T, toFake: ["Date"] });
    try {
      const { db } = fake(ok);
      const t = await withRewards(end, db, KID);
      expect(t.kind === "end" && t.rewards?.xp).toBe(75);
    } finally { vi.useRealTimers(); }
  });
});
