import { CLUSTERS } from "../domain/curriculum";
import { ISLAND_NAMES } from "../domain/rewards/map";
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { kidRecord } = await import("./kidRecord");

const KID = "11111111-1111-4111-8111-111111111111";
const S1 = "22222222-2222-4222-8222-222222222222";
const S2 = "33333333-3333-4333-8333-333333333333";

const skill = (over: Record<string, unknown>) => ({
  kid_id: KID, skill_id: "add-subtract-within-100.add", p_known: 0.4, attempts: 3, level: 2,
  correct_streak: 0, wrong_streak: 1, last_seen: "2026-10-18T20:00:00Z", placed: false,
  recent_tags: [], mastered_at: null, ...over,
});
const session = (id: string, started: string, state: Record<string, unknown>) => ({
  id, kid_id: KID, version: 3, started_at: started, updated_at: started, ended_at: null,
  state: { seed: 99, step: 4, problems: 0, firstTryCorrect: 0, mastered: [], ...state },
});
const attempt = (sessionId: string, at: string, timeMs: number) => ({
  id: 1, kid_id: KID, session_id: sessionId, skill_id: "add-subtract-within-100.add", template_id: "t", seed: 7,
  level: 1, answer: 5, result: "correct", mistake_tag: null, style: null, time_ms: timeMs, at, try: 1, mode: "practice",
});
const empty = { skill_state: [], attempts: [], sessions: [], distress_flags: [] };

describe("kidRecord skills", () => {
  it("names each skill and says learned (with the New York date), learning (with level) or not started", () => {
    const { skills } = kidRecord({
      ...empty,
      skill_state: [
        skill({ skill_id: "add-subtract-within-100.add-regroup", p_known: 0.98, attempts: 5, mastered_at: "2026-10-13T02:00:00Z" }), // Oct 12 in NY
        skill({ skill_id: "add-subtract-within-100.tens", level: 2 }),
        skill({ skill_id: "add-subtract-within-100.add", attempts: 0, last_seen: null }),
      ],
    });
    expect(skills).toEqual([
      { name: "Add with regrouping", status: "Learned Oct 12 · not checked yet", tricky: null },
      { name: "Add and subtract tens", status: "Learning, level 2", tricky: null },
      { name: "Add without regrouping", status: "Not started yet", tricky: null },
    ]);
  });

  it("lists the most recently practised skills first", () => {
    const { skills } = kidRecord({
      ...empty,
      skill_state: [
        skill({ skill_id: "add-subtract-within-100.tens", last_seen: "2026-10-10T20:00:00Z" }),
        skill({ skill_id: "add-subtract-within-100.add", last_seen: "2026-10-18T20:00:00Z" }),
      ],
    });
    expect(skills.map((s) => s.name)).toEqual(["Add without regrouping", "Add and subtract tens"]);
  });

  it("gives the newest mistake in plain words for a skill still being learned, never for a mastered one", () => {
    const { skills } = kidRecord({
      ...empty,
      skill_state: [
        skill({ recent_tags: ["forgot-the-ten", null, "off-by-one-counting", null] }),
        skill({ skill_id: "add-subtract-within-100.tens", recent_tags: ["off-by-ten"], p_known: 0.98, attempts: 5, mastered_at: "2026-10-18T20:00:00Z" }),
      ],
    });
    expect(skills[0]!.tricky).toBe("Counting one too many or too few");
    expect(skills[1]!.tricky).toBeNull();
  });

  it("falls back to the stored code for a skill the curriculum no longer has", () => {
    const { skills } = kidRecord({ ...empty, skill_state: [skill({ skill_id: "retired.skill" })] });
    expect(skills[0]!.name).toBe("retired.skill");
  });
});

describe("kidRecord sessions", () => {
  it("one line per session with problems, newest first, with time, minutes, first-try count and mastered names", () => {
    const { sessions } = kidRecord({
      ...empty,
      sessions: [
        session(S1, "2026-10-17T20:12:00Z", { problems: 1, firstTryCorrect: 1 }),
        session(S2, "2026-10-18T20:12:00Z", {
          problems: 20, firstTryCorrect: 15, mastered: ["add-subtract-within-100.add"],
        }),
      ],
      attempts: [
        attempt(S1, "2026-10-17T20:12:10Z", 4_000),
        attempt(S2, "2026-10-18T20:12:30Z", 5_000),
        attempt(S2, "2026-10-18T20:26:00Z", 5_000), // 13.5 min + 5 s -> 14
      ],
    });
    expect(sessions).toEqual([
      { when: "Sun, Oct 18, 4:12 PM", length: "14 min", problems: "20 problems, 15 right first time", mastered: ["Add without regrouping"], helped: 0 },
      { when: "Sat, Oct 17, 4:12 PM", length: "under a minute", problems: "1 problem, 1 right first time", mastered: [], helped: 0 },
    ]);
  });

  it("counts helped attempts by session, separately from answers and mistakes", () => {
    const { sessions } = kidRecord({
      ...empty,
      sessions: [
        session(S1, "2026-10-18T20:12:00Z", { problems: 1 }),
        session(S2, "2026-10-17T20:12:00Z", { problems: 1 }),
      ],
      attempts: [
        { ...attempt(S1, "2026-10-18T20:12:10Z", 4_000), result: "helped", answer: null },
        { ...attempt(S1, "2026-10-18T20:12:20Z", 4_000), result: "helped", answer: null, try: 2 },
        attempt(S1, "2026-10-18T20:12:30Z", 4_000),
        { ...attempt(S2, "2026-10-17T20:12:10Z", 4_000), result: "wrong" },
        { ...attempt(S2, "2026-10-17T20:12:20Z", 4_000), result: "known-mistake" },
        { ...attempt("other-session", "2026-10-17T20:12:30Z", 4_000), result: "helped", answer: null },
      ],
    });
    expect(sessions.map((s) => s.helped)).toEqual([2, 0]);
  });

  it("leaves out sessions that were opened but had no problems", () => {
    const { sessions } = kidRecord({ ...empty, sessions: [session(S1, "2026-10-18T20:12:00Z", { problems: 0 })] });
    expect(sessions).toEqual([]);
  });
});

describe("kidRecord flagged messages", () => {
  it("shows when, the words, and whether we emailed the parent, newest first", () => {
    const { flags } = kidRecord({
      ...empty,
      distress_flags: [
        { id: 1, line: "i feel sad", at: "2026-10-17T20:00:00Z", emailed_at: "2026-10-17T20:00:05Z" },
        { id: 2, line: "nobody likes me", at: "2026-10-18T20:00:00Z", emailed_at: null },
      ],
    });
    expect(flags).toEqual([
      { when: "Sun, Oct 18, 4:00 PM", line: "nobody likes me", emailed: "Not emailed yet" },
      { when: "Sat, Oct 17, 4:00 PM", line: "i feel sad", emailed: "We emailed you on Oct 17" },
    ]);
  });
});

describe("kidRecord", () => {
  it("is empty for a kid with no data", () => {
    expect(kidRecord(empty)).toEqual({ skills: [], sessions: [], flags: [], needsHand: [], islands: CLUSTERS.map(c => ({ name: ISLAND_NAMES[c.id], summary: "Not started yet", skills: c.skills.map(s => ({ name: s.name, status: "Not started yet", tricky: null })) })) });
  });

  it("never carries ids, seeds or other internal fields into what the page shows", () => {
    const out = JSON.stringify(kidRecord({
      skill_state: [skill({})],
      sessions: [session(S1, "2026-10-18T20:12:00Z", { problems: 2, firstTryCorrect: 1 })],
      attempts: [attempt(S1, "2026-10-18T20:12:10Z", 4_000)],
      distress_flags: [{ id: 7, line: "help", at: "2026-10-18T20:00:00Z", emailed_at: null }],
    }));
    expect(out).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(out).not.toMatch(/seed|p_known|kid_id|session_id|template/);
  });
});


describe("recall skill status", () => {
  const status = (over: Record<string, unknown>) => kidRecord({ ...empty, skill_state: [skill(over)] }).skills[0]!.status;
  it.each([
    [{ p_known: 0.98, attempts: 5, mastered_at: "2026-10-13T02:00:00Z" }, "Learned Oct 12 · not checked yet"],
    [{ p_known: 0.98, attempts: 5, mastered_at: "2026-10-13T02:00:00Z", remembered_at: "2026-10-20T02:00:00Z" }, "Learned Oct 12 · remembered Oct 19"],
    [{ p_known: 0.98, attempts: 0, placed: true }, "Knew at start · not checked yet"],
    [{ p_known: 0.98, attempts: 0, placed: true, remembered_at: "2026-10-20T02:00:00Z" }, "Knew at start · remembered Oct 19"],
    [{ p_known: 0.4, mastered_at: "2026-10-13T02:00:00Z", remembered_at: "2026-10-14T20:00:00Z" }, "Practicing again"],
    [{ p_known: 0.98, attempts: 4 }, "Learning, level 2"],
    [{ attempts: 0 }, "Not started yet"],
  ])("formats %j", (row, expected) => { expect(status(row)).toBe(expected); });

  it("keeps placement wording after forgetting and re-learning", () => {
    const row = { placed: true, p_known: 0.98, attempts: 0, mastered_at: "2026-10-13T02:00:00Z" };
    expect(status(row)).toBe("Knew at start · not checked yet");
    expect(status({ ...row, p_known: 0.4, attempts: 2 })).toBe("Practicing again");
    expect(status({ ...row, p_known: 0.98, attempts: 8 })).toBe("Knew at start · not checked yet");
    expect(status({ ...row, p_known: 0.98, attempts: 8, remembered_at: "2026-10-20T02:00:00Z" })).toBe("Knew at start · remembered Oct 19");
  });
});


describe("island progress", () => {
  const cluster = CLUSTERS[0]!;
  const rows = () => cluster.skills.map(s => skill({ skill_id: s.id, p_known: 0.98, attempts: 5 }));
  it("lists every island and missing skill in teaching order, excluding unknown ids", () => {
    const record = kidRecord({ ...empty, skill_state: [skill({ skill_id: "retired.skill" })] });
    expect(record.islands).toEqual(CLUSTERS.map(c => ({ name: ISLAND_NAMES[c.id], summary: "Not started yet", skills: c.skills.map(s => ({ name: s.name, status: "Not started yet", tricky: null })) })));
    expect(record.skills[0]!.name).toBe("retired.skill");
  });
  it("counts all currently learned skills, including placement without attempts", () => {
    const all = rows();
    all[0] = skill({ skill_id: cluster.skills[0]!.id, placed: true, attempts: 0, p_known: 0.98 });
    expect(kidRecord({ ...empty, skill_state: all }).islands[0]!.summary).toBe(`All ${all.length} learned ✓`);
  });
  it("counts partial mastery and chooses the newest attempted unmastered skill", () => {
    const all = rows();
    all[0] = skill({ skill_id: cluster.skills[0]!.id, mastered_at: "2026-10-01", last_seen: "2026-10-20" });
    all[1] = skill({ skill_id: cluster.skills[1]!.id, last_seen: "2026-10-19" });
    const island = kidRecord({ ...empty, skill_state: all }).islands[0]!;
    expect(island.summary).toBe(`${all.length - 2} of ${all.length} learned · working on ${cluster.skills[0]!.name}`);
    expect(island.skills[0]!.status).toBe("Practicing again");
  });
  it("omits working-on when only placement and missing rows exist", () => {
    expect(kidRecord({ ...empty, skill_state: [skill({ skill_id: cluster.skills[0]!.id, placed: true, attempts: 0, p_known: 0.98 })] }).islands[0]!.summary).toBe(`1 of ${cluster.skills.length} learned`);
  });
  it("says zero learned for attempted skills and not started for zero attempts", () => {
    expect(kidRecord({ ...empty, skill_state: [skill({ skill_id: cluster.skills[0]!.id })] }).islands[0]!.summary).toBe(`0 of ${cluster.skills.length} learned · working on ${cluster.skills[0]!.name}`);
    expect(kidRecord({ ...empty, skill_state: [skill({ skill_id: cluster.skills[0]!.id, attempts: 0 })] }).islands[0]!.summary).toBe("Not started yet");
  });
  it("filters needs-hand, orders newest first and caps at three", () => {
    const states = [
      skill({ skill_id: "old", recent_tags: ["off-by-ten"], last_seen: null }),
      skill({ skill_id: "again", mastered_at: "2026-10-01", last_seen: "2026-10-21" }),
      skill({ skill_id: "tricky", recent_tags: ["off-by-ten"], last_seen: "2026-10-20" }),
      skill({ skill_id: "third", recent_tags: ["off-by-ten"], last_seen: "2026-10-19" }),
      skill({ skill_id: "plain", last_seen: "2026-10-22" }),
      skill({ skill_id: "learned", p_known: 0.98, attempts: 5, recent_tags: ["off-by-ten"], last_seen: "2026-10-23" }),
    ];
    expect(kidRecord({ ...empty, skill_state: states }).needsHand.map(s => s.name)).toEqual(["again", "tricky", "third"]);
    expect(kidRecord({ ...empty, skill_state: states.slice(4) }).needsHand).toEqual([]);
  });
});

describe("island current-skill fallback", () => {
  const cluster = CLUSTERS[2]!;
  const current = cluster.skills[0]!;
  it("uses the current skill when it has no row, without changing stored skills", () => {
    const record = kidRecord(empty, current.name);
    expect(record.islands[2]!.summary).toBe(`0 of ${cluster.skills.length} learned · working on ${current.name}`);
    expect(record.islands[2]!.skills[0]).toEqual({ name: current.name, status: "Working on it", tricky: null });
    expect(record.islands[2]!.skills.slice(1).every(s => s.status === "Not started yet")).toBe(true);
    expect(record.islands.filter((_, i) => i !== 2)).toEqual(kidRecord(empty).islands.filter((_, i) => i !== 2));
    expect(record.skills).toEqual([]);
    expect(record.needsHand).toEqual([]);
  });
  it("keeps the row rule when the current skill has a row", () => {
    const data = { ...empty, skill_state: [skill({ skill_id: current.id, last_seen: "2026-10-19" }), skill({ skill_id: cluster.skills[1]!.id, last_seen: "2026-10-20" })] };
    expect(kidRecord(data, current.name)).toEqual(kidRecord(data));
    expect(kidRecord(data, current.name).islands[2]!.skills[0]!.status).toBe("Learning, level 2");
  });
  it("prefers an attempted row over the current skill with no row", () => {
    const data = { ...empty, skill_state: [skill({ skill_id: cluster.skills[1]!.id })] };
    const island = kidRecord(data, current.name).islands[2]!;
    expect(island.summary).toBe(`0 of ${cluster.skills.length} learned · working on ${cluster.skills[1]!.name}`);
    expect(island.skills[0]!.status).toBe("Working on it");
  });
  it.each([null, "Unknown skill"])("leaves everything unchanged for %s", currentSkill => {
    expect(kidRecord(empty, currentSkill)).toEqual(kidRecord(empty));
  });
});
